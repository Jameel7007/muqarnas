import {
  FACTOR_PER_MODULE,
  Frac,
  Q2,
  Pt,
  dot2,
  interiorAngleUnits,
  lineIntersect,
  worldOutline,
  type Plan,
} from '@muqarnas/plan';
import { MeshBuilder, type Mesh } from './mesh.js';
import type { LiftedTriangle } from './simple.js';

/**
 * The CURVED (qawsī) cell — the visually canonical muqarnas element type.
 *
 * Anatomy (al-Kāshī via Dold-Samplonius 1992; Harmsen ch. 2): a cell stands
 * on its plan shape with its apex at the CENTRAL NODE O, where its two
 * module-length CURVED SIDES meet. Its two FACETS are vertical walls on the
 * remaining (backside) edges, meeting at the opposite node, of height the
 * factor GH = 2 − (3/5)√3 ≈ 0.9608. The ROOF is two panels meeting along
 * the ridge over the diameter O–C; each panel is a CYLINDER: al-Kāshī's
 * profile stands over the curved side (facet-height at the far end, cell
 * height 2 at the apex) and is extruded parallel to the facet edge. The
 * facet-top edge is the profile's foot; the ridge is where the two mirror
 * cylinders intersect — its projection is the main diagonal drawn in the
 * historical plans. The same construction with a linear profile gives the
 * simple type's two plane roofs.
 *
 * Exactness: generator feet and ridge points are computed in ℚ(√2) at
 * rational profile parameters, so vertices weld exactly — across the ridge
 * inside one cell, and across shared curved sides between neighbouring
 * cells (both cells sample the same u schedule from the same tail).
 *
 * v1 scope: cells only, unit module, uniform tier height 2. Intermediates
 * and the tier-joint geometry arrive with the graph solver.
 */

export interface CurvedCellSpec {
  readonly placedIndex: number;
  /** 1-based tier; falls back to the placed element's tier hint. */
  readonly tier?: number;
  /**
   * World-outline vertex index of the central node. Required for square and
   * rhombus (their shape fixes no orientation); the fixed-anatomy kinds
   * carry their own and reject a conflicting override.
   */
  readonly centralNode?: number;
}

export interface CurvedLiftParams {
  /** Subdivision of the 60° arc portion of the profile. */
  readonly arcSegments?: number;
  /** Subdivision of the straight 30° ramp portion. */
  readonly rampSegments?: number;
}

export const DEFAULT_CURVED_PARAMS: Required<CurvedLiftParams> = {
  arcSegments: 12,
  rampSegments: 6,
};

export interface CurvedVault {
  readonly mesh: Mesh;
  readonly tris: LiftedTriangle[];
}

const GH = FACTOR_PER_MODULE;
const TAN30 = Math.tan(Math.PI / 6);
/** Cell height in modules (the 1:2 elevation). */
export const CELL_HEIGHT = 2;

/**
 * Height of the profile over horizontal position u ∈ [0,1] from the facet
 * plane toward the apex: 60° arc (radius 4/5, centre (4/5, GH)), then the
 * 30° ramp. h(0) = GH, h(1) = 2, monotone, tangent-continuous.
 */
export function profileHeight(u: number): number {
  if (u <= 0.4) {
    const dx = u - 0.8;
    return GH + Math.sqrt(Math.max(0, 0.64 - dx * dx));
  }
  return CELL_HEIGHT - (1 - u) * TAN30;
}

/**
 * Rational sample positions along the profile: arc knots (quadratically
 * spaced — the arc leaves the facet vertically, and u ∝ t² is asymptotically
 * uniform in arc angle there, so chords stay short where the curve is
 * steep), the kink at 2/5, then linear ramp knots. Rational values keep the
 * generator feet in ℚ(√2), which is what makes welding exact.
 */
function uSchedule(arcSegments: number, rampSegments: number): Frac[] {
  const us: Frac[] = [];
  for (let k = 0; k <= arcSegments; k++) us.push(Frac.of(2 * k * k, 5 * arcSegments * arcSegments));
  for (let j = 1; j <= rampSegments; j++) us.push(Frac.of(2 * rampSegments + 3 * j, 5 * rampSegments));
  return us;
}

export function liftCurvedCells(
  plan: Plan,
  specs: readonly CurvedCellSpec[],
  params: CurvedLiftParams = {},
): CurvedVault {
  const arcSegments = params.arcSegments ?? DEFAULT_CURVED_PARAMS.arcSegments;
  const rampSegments = params.rampSegments ?? DEFAULT_CURVED_PARAMS.rampSegments;
  const us = uSchedule(arcSegments, rampSegments);
  const K = us.length - 1;

  const b = new MeshBuilder();
  const tris: LiftedTriangle[] = [];
  const covered = new Set<number>();

  specs.forEach((spec, cellIdx) => {
    const placed = plan.placed[spec.placedIndex];
    if (!placed) throw new Error(`liftCurvedCells: no placed element at ${spec.placedIndex}`);
    if (covered.has(spec.placedIndex)) throw new Error(`liftCurvedCells: element ${spec.placedIndex} lifted twice`);
    covered.add(spec.placedIndex);
    if (placed.role !== 'cell') {
      throw new Error(`liftCurvedCells: element ${spec.placedIndex} is an intermediate; cells only for now`);
    }
    const tier = spec.tier ?? placed.tier;
    if (tier === undefined) throw new Error(`liftCurvedCells: element ${spec.placedIndex} has no tier`);

    const { verts, centralNode: fixed } = worldOutline(placed);
    const n = verts.length;
    const c = spec.centralNode ?? fixed;
    if (c === null || c === undefined) {
      throw new Error(`liftCurvedCells: ${placed.def.kind} needs an explicit centralNode`);
    }
    if (fixed !== null && spec.centralNode !== undefined && spec.centralNode !== fixed) {
      throw new Error(`liftCurvedCells: ${placed.def.kind} has its central node at ${fixed}, not ${spec.centralNode}`);
    }

    const O = verts[c]!;
    const A1 = verts[(c + 1) % n]!;
    const A2 = verts[(c - 1 + n) % n]!;
    for (const a of [A1, A2]) {
      const v = a.sub(O);
      if (!dot2(v, v).eq(Q2.ONE)) {
        throw new Error(`liftCurvedCells: curved side of ${placed.def.kind} is not module length`);
      }
    }
    const apexAngle = interiorAngleUnits(verts, c);
    if (apexAngle !== 2 && apexAngle !== 4 && apexAngle !== 6) {
      throw new Error(`liftCurvedCells: apex angle ${apexAngle * 22.5}° is not 45/90/135`);
    }
    const Cop = n === 4 ? verts[(c + 2) % 4]! : A1.add(A2).scale(Q2.HALF);

    const z0 = (tier - 1) * CELL_HEIGHT;
    const zTag = (k: number) => `L${tier}:${k}`;
    const vAt = (p: Pt, tag: string, z: number) => {
      const [x, y] = p.toNumbers();
      return b.vertex(`${p.key()}@${tag}`, x, y, z);
    };

    // ---- facets: vertical walls on the backside path A1 → Cop → A2 ----
    const zF = z0 + GH;
    for (const [fa, fb] of [
      [A1, Cop],
      [Cop, A2],
    ] as const) {
      const i0 = vAt(fa, `B${tier}`, z0);
      const i1 = vAt(fb, `B${tier}`, z0);
      const i2 = vAt(fb, zTag(0), zF);
      const i3 = vAt(fa, zTag(0), zF);
      b.quad(i0, i1, i2, i3);
      tris.push({ role: 'facet', cell: cellIdx }, { role: 'facet', cell: cellIdx });
    }

    // ---- roof panels: cylinders over (O, A1, Cop) and (O, Cop, A2) ----
    type Gen = { q: Pt; r: Pt; z: number };
    const generators = (Afar: Pt): Gen[] => {
      const side = O.sub(Afar);
      const dFacet = Cop.sub(Afar);
      const ridgeDir = Cop.sub(O);
      return us.map((uf, k) => {
        const q = Afar.add(side.scale(Q2.of(uf)));
        const r = k === K ? O : lineIntersect(q, dFacet, O, ridgeDir);
        return { q, r, z: z0 + profileHeight(uf.toNumber()) };
      });
    };
    const panelA = generators(A1);
    const panelB = generators(A2);
    for (let k = 0; k <= K; k++) {
      if (!panelA[k]!.r.eq(panelB[k]!.r)) {
        throw new Error(`liftCurvedCells: ${placed.def.kind} ridge mismatch — cell not diameter-symmetric`);
      }
    }

    const emitPanel = (gens: Gen[]) => {
      // orient so projected winding is CCW (normals consistent with facets)
      const g0 = gens[0]!;
      const g1 = gens[1]!;
      const sign =
        (g0.r.toNumbers()[0] - g0.q.toNumbers()[0]) * (g1.q.toNumbers()[1] - g0.q.toNumbers()[1]) -
        (g0.r.toNumbers()[1] - g0.q.toNumbers()[1]) * (g1.q.toNumbers()[0] - g0.q.toNumbers()[0]);
      const flip = sign < 0; // q1 right of q0→r0 ⇒ (q,r,r,q) order is CW ⇒ reverse
      for (let k = 0; k < K; k++) {
        const ga = gens[k]!;
        const gb = gens[k + 1]!;
        const qa = vAt(ga.q, zTag(k), ga.z);
        const ra = vAt(ga.r, zTag(k), ga.z);
        const qb = vAt(gb.q, zTag(k + 1), gb.z);
        const rb = vAt(gb.r, zTag(k + 1), gb.z);
        if (k === K - 1) {
          // apex strip degenerates to one triangle (qb = rb = O)
          if (flip) b.tri(qa, qb, ra);
          else b.tri(qa, ra, qb);
          tris.push({ role: 'roof', cell: cellIdx });
        } else {
          if (flip) b.quad(qa, qb, rb, ra);
          else b.quad(qa, ra, rb, qb);
          tris.push({ role: 'roof', cell: cellIdx }, { role: 'roof', cell: cellIdx });
        }
      }
    };
    emitPanel(panelA);
    emitPanel(panelB);
  });

  return { mesh: b.build(), tris };
}

/** Number of profile segments for a given parameter set (boundary bookkeeping). */
export function profileSegments(params: CurvedLiftParams = {}): number {
  return (
    (params.arcSegments ?? DEFAULT_CURVED_PARAMS.arcSegments) +
    (params.rampSegments ?? DEFAULT_CURVED_PARAMS.rampSegments)
  );
}
