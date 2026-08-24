import { BufferAttribute, BufferGeometry } from 'three';
import type { LiftedTriangle } from '@muqarnas/lift';

/**
 * Pre-baked vault assets. The plan, the solver, and the lift are
 * deterministic — and the AO bake is seeded — so recomputing them on
 * every visit wastes the visitor's CPU and delays first render. A build
 * step runs the full pipeline once and serialises the WELDED geometry
 * (positions, index, baked occlusion) plus the per-triangle metadata
 * (role, cell, tier) that the paint pass and the rig consume.
 *
 * Deliberately NOT stored: normals, paint, ornament, glow. Those are
 * derived from the stored data in milliseconds at load time by the same
 * live code paths (creased normals, withPaintAttribute), which keeps the
 * asset a quarter of the size and lets paint fixes ship without
 * re-baking. The fixture test proves the stored artifacts identical to a
 * fresh run.
 *
 * Staleness guard: a schema version plus an FNV-1a hash of the recipe
 * parameters (lift options, AO options, reading selection) are embedded
 * in the header; the loader rejects any mismatch and the site falls back
 * to computing live.
 */

export const BAKED_SCHEMA_VERSION = 1;

const MAGIC = 0x4d51424b; // 'MQBK'

/** FNV-1a over a canonical JSON string — a fingerprint, not cryptography. */
export function hashParams(params: unknown): number {
  const s = `${BAKED_SCHEMA_VERSION}:${JSON.stringify(params)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const ROLE_CODE = { facet: 0, roof: 1, wall: 2 } as const;
const ROLE_NAME = ['facet', 'roof', 'wall'] as const;

// header: magic, schema, paramsHash, vertexCount, triCount, reserved
const HEADER_U32 = 6;

export interface BakedReading {
  /** welded geometry with position, index, ao, and default paint attributes */
  readonly welded: BufferGeometry;
  readonly tris: LiftedTriangle[];
}

export function encodeBakedReading(
  welded: BufferGeometry,
  tris: readonly LiftedTriangle[],
  paramsHash: number,
): ArrayBuffer {
  const pos = welded.getAttribute('position');
  const ao = welded.getAttribute('ao');
  const index = welded.getIndex();
  if (!index) throw new Error('baked: welded geometry must be indexed');
  const V = pos.count;
  const T = tris.length;
  if (index.count !== T * 3) {
    throw new Error(`baked: index (${index.count / 3} triangles) does not match ${T} metadata rows`);
  }

  // 4-byte sections first, then 2-byte, then 1-byte — no padding needed
  const bytes = HEADER_U32 * 4 + 12 * V + 4 * V + 12 * T + 4 * T + 2 * T + T;
  const buf = new ArrayBuffer(bytes);
  let off = 0;
  const header = new Uint32Array(buf, off, HEADER_U32);
  off += HEADER_U32 * 4;
  header.set([MAGIC, BAKED_SCHEMA_VERSION, paramsHash, V, T, 0]);

  new Float32Array(buf, off, V * 3).set(pos.array as Float32Array);
  off += 12 * V;
  new Float32Array(buf, off, V).set(ao.array as Float32Array);
  off += 4 * V;
  const idx = new Uint32Array(buf, off, T * 3);
  off += 12 * T;
  for (let i = 0; i < T * 3; i++) idx[i] = index.getX(i);
  const cell = new Int32Array(buf, off, T);
  off += 4 * T;
  const tier = new Int16Array(buf, off, T);
  off += 2 * T;
  const role = new Uint8Array(buf, off, T);
  for (let t = 0; t < T; t++) {
    cell[t] = tris[t]!.cell;
    tier[t] = tris[t]!.tier ?? -1;
    role[t] = ROLE_CODE[tris[t]!.role];
  }
  return buf;
}

/**
 * Decode and validate. Returns null (never throws) on any mismatch —
 * wrong magic, foreign schema, stale recipe hash, or a truncated file —
 * so callers can fall back to computing live.
 */
export function decodeBakedReading(buf: ArrayBuffer, expectedHash: number): BakedReading | null {
  if (buf.byteLength < HEADER_U32 * 4) return null;
  const header = new Uint32Array(buf, 0, HEADER_U32);
  const [magic, version, hash, V, T] = [header[0]!, header[1]!, header[2]!, header[3]!, header[4]!];
  if (magic !== MAGIC || version !== BAKED_SCHEMA_VERSION || hash !== expectedHash) return null;
  const bytes = HEADER_U32 * 4 + 12 * V + 4 * V + 12 * T + 4 * T + 2 * T + T;
  if (buf.byteLength !== bytes) return null;

  let off = HEADER_U32 * 4;
  const positions = new Float32Array(buf, off, V * 3);
  off += 12 * V;
  const ao = new Float32Array(buf, off, V);
  off += 4 * V;
  const idx = new Uint32Array(buf, off, T * 3);
  off += 12 * T;
  const cell = new Int32Array(buf, off, T);
  off += 4 * T;
  const tier = new Int16Array(buf, off, T);
  off += 2 * T;
  const role = new Uint8Array(buf, off, T);

  // reconstruct exactly what vaultToGeometry + bakeVertexAO produce: the
  // index is stored already flipped toward the seen surface
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setIndex(new BufferAttribute(new Uint32Array(idx), 1));
  g.setAttribute('ao', new BufferAttribute(new Float32Array(ao), 1));
  g.setAttribute('paint', new BufferAttribute(new Float32Array(V), 1));
  g.setAttribute('orn', new BufferAttribute(new Float32Array(V * 3), 3));
  g.setAttribute('glow', new BufferAttribute(new Float32Array(V), 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();

  const tris: LiftedTriangle[] = new Array(T);
  for (let t = 0; t < T; t++) {
    tris[t] = {
      role: ROLE_NAME[role[t]!]!,
      cell: cell[t]!,
      ...(tier[t]! >= 0 ? { tier: tier[t]! } : {}),
    };
  }
  return { welded: g, tris };
}
