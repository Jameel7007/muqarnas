import { BufferAttribute, DoubleSide, Ray, Vector3, type BufferGeometry } from 'three';
import { MeshBVH } from 'three-mesh-bvh';

/**
 * Baked per-vertex ambient occlusion — the spec's budgeted answer to the
 * fact that stepped concave cells are an occlusion problem before they are
 * a shading problem, and screen-space AO goes muddy at these depths.
 *
 * Cosine-weighted hemisphere rays about the smooth vertex normal against a
 * BVH of the whole vault; occlusion is distance-attenuated so a cell's own
 * hood darkens it more than the far side of the vault does. Deterministic
 * (seeded RNG), chunked so a page can show progress.
 */

export interface AoOptions {
  readonly rays?: number;
  readonly maxDistance?: number;
  readonly seed?: number;
  readonly yieldEvery?: number;
  readonly onProgress?: (done: number, total: number) => void;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function bakeVertexAO(
  geometry: BufferGeometry,
  opts: AoOptions = {},
): Promise<{ min: number; mean: number }> {
  const rays = opts.rays ?? 48;
  const maxDistance = opts.maxDistance ?? 6;
  const yieldEvery = opts.yieldEvery ?? 1500;
  const rand = mulberry32(opts.seed ?? 1427);

  const bvh = new MeshBVH(geometry);
  const pos = geometry.getAttribute('position');
  const nrm = geometry.getAttribute('normal');
  const count = pos.count;
  const ao = new Float32Array(count);

  const n = new Vector3();
  const t1 = new Vector3();
  const t2 = new Vector3();
  const dir = new Vector3();
  const ray = new Ray();

  for (let i = 0; i < count; i++) {
    n.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i)).normalize();
    // tangent frame
    t1.set(1, 0, 0);
    if (Math.abs(n.x) > 0.9) t1.set(0, 1, 0);
    t1.cross(n).normalize();
    t2.crossVectors(n, t1);

    let occlusion = 0;
    for (let r = 0; r < rays; r++) {
      // cosine-weighted hemisphere sample
      const u = rand();
      const v = rand();
      const sinTheta = Math.sqrt(u);
      const phi = 2 * Math.PI * v;
      dir
        .copy(n)
        .multiplyScalar(Math.sqrt(1 - u))
        .addScaledVector(t1, sinTheta * Math.cos(phi))
        .addScaledVector(t2, sinTheta * Math.sin(phi));
      ray.origin.set(pos.getX(i), pos.getY(i), pos.getZ(i)).addScaledVector(n, 1e-3);
      ray.direction.copy(dir);
      const hit = bvh.raycastFirst(ray, DoubleSide);
      if (hit && hit.distance < maxDistance) {
        occlusion += 1 - hit.distance / maxDistance;
      }
    }
    ao[i] = 1 - occlusion / rays;

    if (opts.onProgress && i % yieldEvery === 0) {
      opts.onProgress(i, count);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  opts.onProgress?.(count, count);

  geometry.setAttribute('ao', new BufferAttribute(ao, 1));
  let min = Infinity;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    min = Math.min(min, ao[i]!);
    sum += ao[i]!;
  }
  return { min, mean: sum / count };
}
