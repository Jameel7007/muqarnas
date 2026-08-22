import {
  area,
  worldEdgeIndex,
  worldOutline,
  type Plan,
} from '@muqarnas/plan';
import { MeshBuilder, type Mesh } from './mesh.js';

/**
 * The lift for al-Kāshī's SIMPLE (sāda) type: plane facets, plane roofs.
 *
 * Within a tier every facet is a vertical band rising `facetHeight` from the
 * tier base along the cell's front rib; the roof spans from the facet's top
 * edge back to the cell's remaining outline at the tier top. All facets in a
 * tier share the bottom line, all roofs share the top line — al-Kāshī's own
 * description of a tier.
 *
 * v0 scope: cells only (no intermediate elements yet — their lift semantics
 * come with the sourced tier rules), and the front rib is supplied per cell
 * rather than solved. Tier heights are uniform and module-derived; the
 * defaults are provisional until the sources pin them.
 */

export interface SimpleLiftParams {
  readonly tierHeight: number;
  readonly facetHeight: number;
}

export const DEFAULT_SIMPLE_PARAMS: SimpleLiftParams = {
  // Al-Kāshī on the simple type: the facet height "in most cases is the
  // amount of the module." The roof rise is a fitting parameter — his
  // measurement even counts simple roofs as if flat — so the tier height
  // above one module is a modelling choice.
  tierHeight: 1.5,
  facetHeight: 1,
};

export interface CellSpec {
  /** Index into plan.placed. */
  readonly placedIndex: number;
  /** Canonical (definition-space) edge index of the cell's front rib. */
  readonly frontEdge: number;
  /** 1-based tier; falls back to the placed element's tier hint. */
  readonly tier?: number;
}

export interface LiftedTriangle {
  readonly role: 'facet' | 'roof';
  readonly cell: number; // index into the specs array
}

export interface LiftedVault {
  readonly mesh: Mesh;
  /** One entry per triangle, aligned with mesh.triangles/3. */
  readonly tris: LiftedTriangle[];
  readonly params: SimpleLiftParams;
}

export function liftSimple(
  plan: Plan,
  specs: readonly CellSpec[],
  params: SimpleLiftParams = DEFAULT_SIMPLE_PARAMS,
): LiftedVault {
  const { tierHeight: H, facetHeight: F } = params;
  if (!(F > 0) || !(H > F)) {
    throw new Error('liftSimple: need 0 < facetHeight < tierHeight');
  }
  const b = new MeshBuilder();
  const tris: LiftedTriangle[] = [];

  const covered = new Set<number>();
  specs.forEach((spec, cellIdx) => {
    const placed = plan.placed[spec.placedIndex];
    if (!placed) throw new Error(`liftSimple: no placed element at index ${spec.placedIndex}`);
    if (covered.has(spec.placedIndex)) {
      throw new Error(`liftSimple: element ${spec.placedIndex} lifted twice`);
    }
    covered.add(spec.placedIndex);
    if (placed.role !== 'cell') {
      throw new Error(`liftSimple: element ${spec.placedIndex} is an intermediate; v0 lifts cells only`);
    }
    const tier = spec.tier ?? placed.tier;
    if (tier === undefined) {
      throw new Error(`liftSimple: element ${spec.placedIndex} has no tier`);
    }

    const { verts } = worldOutline(placed);
    const n = verts.length;
    const wf = worldEdgeIndex(placed, spec.frontEdge);

    // Symbolic z-levels: z = a·H + b·F. Tier t's base is (t−1, 0), its facet
    // top (t−1, 1), its top (t, 0) — which is exactly tier t+1's base, so
    // vertices weld across the tier joint and tier continuity is structural.
    const zb = (tier - 1) * H;
    const zf = zb + F;
    const zt = tier * H;
    const kb = (i: number) => `${verts[i]!.key()}@${tier - 1},0`;
    const kf = (i: number) => `${verts[i]!.key()}@${tier - 1},1`;
    const kt = (i: number) => `${verts[i]!.key()}@${tier},0`;
    const vAt = (key: string, i: number, z: number) => {
      const [x, y] = verts[i]!.toNumbers();
      return b.vertex(key, x, y, z);
    };

    const i0 = wf;
    const i1 = (wf + 1) % n;

    // Facet: vertical quad on the front rib.
    const b0 = vAt(kb(i0), i0, zb);
    const b1 = vAt(kb(i1), i1, zb);
    const f1 = vAt(kf(i1), i1, zf);
    const f0 = vAt(kf(i0), i0, zf);
    b.quad(b0, b1, f1, f0);
    tris.push({ role: 'facet', cell: cellIdx }, { role: 'facet', cell: cellIdx });

    // Roof: from the facet top edge back over the rest of the outline at the
    // tier top, fanned from the front corner. Plan-CCW order throughout.
    const ring: number[] = [f0, f1];
    for (let k = 2; k < n; k++) {
      const i = (wf + k) % n;
      ring.push(vAt(kt(i), i, zt));
    }
    for (let k = 1; k + 1 < ring.length; k++) {
      b.tri(ring[0]!, ring[k]!, ring[k + 1]!);
      tris.push({ role: 'roof', cell: cellIdx });
    }
  });

  return { mesh: b.build(), tris, params };
}

/** Exact plan area of the cell a spec refers to, as a float. */
export function cellPlanArea(plan: Plan, spec: CellSpec): number {
  const placed = plan.placed[spec.placedIndex]!;
  return area(worldOutline(placed).verts).toNumber();
}
