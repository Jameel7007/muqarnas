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

/* ====================================================================== *
 *  THE FULL VAULT: solver output → watertight multi-tier mesh
 * ====================================================================== */

/**
 * One face of a solved assignment (structurally identical to the solver's
 * SolvedFace): what the face is, where its pivot sits, which tier.
 */
export interface VaultFaceSpec {
  readonly placedIndex: number;
  readonly type: 'cell' | 'intermediate';
  readonly centralNode: number;
  readonly tier: number;
}

export interface VaultLiftOptions extends CurvedLiftParams {
  /**
   * Whether a boundary edge gets a closure wall down to the springing.
   * Default: close everything (pass a predicate to keep e.g. the crown rim
   * open).
   */
  readonly closeBoundary?: (a: Pt, b: Pt) => boolean;
}

/**
 * Lift a whole solved vault:
 *
 * - CELLS as in liftCurvedCells: two facets on the backside path, two
 *   cylinder roof panels meeting over the diameter.
 * - INTERMEDIATES as the cell construction inverted (al-Kāshī: "a curved
 *   surface in the form of a triangle or two triangles"): the two curved
 *   sides carry the same profile rising from the tail — which sits exactly
 *   on top of the neighbouring cells' shared facet corner, at factor
 *   height — to the heads at the tier top; panels sweep parallel to the
 *   fronts, whose flat top edges are where the next tier's facets stand.
 * - RISER BANDS close the joints the tier structure leaves: between a
 *   lower crease (the shared profile of the faces below) and the straight
 *   line of an upper facet bottom or intermediate front; and, when
 *   requested, from the springing (z = 0) up to whatever the vault does
 *   along a boundary edge.
 *
 * Everything welds by construction: one u-schedule, one tag scheme
 * (`Z<m>` for tier levels, `P<tier>:<k>` for profile samples), exact
 * ℚ(√2) sample points.
 */
export function liftVault(
  plan: Plan,
  specs: readonly VaultFaceSpec[],
  opts: VaultLiftOptions = {},
): CurvedVault {
  const arcSegments = opts.arcSegments ?? DEFAULT_CURVED_PARAMS.arcSegments;
  const rampSegments = opts.rampSegments ?? DEFAULT_CURVED_PARAMS.rampSegments;
  const us = uSchedule(arcSegments, rampSegments);
  const K = us.length - 1;
  const uNum = us.map((f) => f.toNumber());

  const b = new MeshBuilder();
  const tris: LiftedTriangle[] = [];

  const zTag = (tier: number, k: number) => (k === K ? `Z${tier}` : `P${tier}:${k}`);
  const vAt = (p: Pt, tag: string, z: number) => {
    const [x, y] = p.toNumbers();
    return b.vertex(`${p.key()}@${tag}`, x, y, z);
  };
  const vLevel = (p: Pt, m: number) => vAt(p, `Z${m}`, m * CELL_HEIGHT);

  interface SideUse {
    spec: VaultFaceSpec;
    curved: boolean;
    /** the face's CCW traversal of this edge — panels and facets follow it,
     *  so closures orient against it structurally */
    from: Pt;
    to: Pt;
    /** for curved sides: the tail (low) endpoint */
    tail?: Pt;
    head?: Pt;
  }
  const edgeUses = new Map<string, { a: Pt; b: Pt; uses: SideUse[] }>();
  const noteEdge = (va: Pt, vb: Pt, use: SideUse) => {
    const ka = va.key();
    const kb = vb.key();
    const key = ka < kb ? `${ka}~${kb}` : `${kb}~${ka}`;
    let e = edgeUses.get(key);
    if (!e) {
      e = { a: ka < kb ? va : vb, b: ka < kb ? vb : va, uses: [] };
      edgeUses.set(key, e);
    }
    e.uses.push(use);
  };

  interface Gen {
    q: Pt;
    r: Pt;
    z: number;
    k: number;
  }
  /** Generators for a panel: from the curved side (tail→head) to the ridge. */
  const generators = (
    tail: Pt,
    head: Pt,
    genDir: Pt, // direction of the generators (towards the ridge)
    ridgeA: Pt,
    ridgeB: Pt,
    zBase: number,
  ): Gen[] => {
    const side = head.sub(tail);
    const ridgeDir = ridgeB.sub(ridgeA);
    return us.map((uf, k) => {
      const q = tail.add(side.scale(Q2.of(uf)));
      let r: Pt;
      if (q.eq(ridgeA)) r = ridgeA;
      else if (q.eq(ridgeB)) r = ridgeB;
      else r = lineIntersect(q, genDir, ridgeA, ridgeDir);
      return { q, r, z: zBase + profileHeight(uNum[k]!), k };
    });
  };

  const emitStrips = (
    gens: Gen[],
    tier: number,
    role: LiftedTriangle['role'],
    cellIdx: number,
  ) => {
    // orient by projected winding, measured at the first generator whose
    // foot and ridge point differ (cells degenerate at the apex end,
    // intermediates at the tail end)
    const m = gens.findIndex((g) => !g.q.eq(g.r));
    const gm = gens[m]!;
    const gn = gens[m + 1 <= K ? m + 1 : m - 1]!;
    const [q0x, q0y] = gm.q.toNumbers();
    const [r0x, r0y] = gm.r.toNumbers();
    const [q1x, q1y] = gn.q.toNumbers();
    let sign = (r0x - q0x) * (q1y - q0y) - (r0y - q0y) * (q1x - q0x);
    if (m + 1 > K) sign = -sign;
    const flip = sign < 0;
    for (let k = 0; k + 1 < gens.length; k++) {
      const ga = gens[k]!;
      const gb = gens[k + 1]!;
      const qa = vAt(ga.q, zTag(tier, ga.k), ga.z);
      const ra = vAt(ga.r, zTag(tier, ga.k), ga.z);
      const qb = vAt(gb.q, zTag(tier, gb.k), gb.z);
      const rb = vAt(gb.r, zTag(tier, gb.k), gb.z);
      const degenerateA = qa === ra;
      const degenerateB = qb === rb;
      if (degenerateA && degenerateB) continue;
      if (degenerateB) {
        if (flip) b.tri(qa, qb, ra);
        else b.tri(qa, ra, qb);
        tris.push({ role, cell: cellIdx });
      } else if (degenerateA) {
        if (flip) b.tri(qa, qb, rb);
        else b.tri(qa, rb, qb);
        tris.push({ role, cell: cellIdx });
      } else {
        if (flip) b.quad(qa, qb, rb, ra);
        else b.quad(qa, ra, rb, qb);
        tris.push({ role, cell: cellIdx }, { role, cell: cellIdx });
      }
    }
  };

  const outlineOf = (spec: VaultFaceSpec) => {
    const placed = plan.placed[spec.placedIndex];
    if (!placed) throw new Error(`liftVault: no placed element at ${spec.placedIndex}`);
    return { placed, outline: worldOutline(placed) };
  };

  /* ---------- pass 1: cells and intermediates ---------- */
  specs.forEach((spec, cellIdx) => {
    const { outline } = outlineOf(spec);
    const verts = outline.verts;
    const n = verts.length;
    const c = spec.centralNode;
    const C = verts[c]!;
    const A1 = verts[(c + 1) % n]!;
    const A2 = verts[(c - 1 + n) % n]!;
    const tier = spec.tier;
    const zBase = (tier - 1) * CELL_HEIGHT;

    if (spec.type === 'cell') {
      const Cop = n === 4 ? verts[(c + 2) % n]! : A1.add(A2).scale(Q2.HALF);
      // facets — two back-to-back cells emit coincident quads deliberately:
      // one physical wall, both faces visible
      for (const [fa, fb] of [
        [A1, Cop],
        [Cop, A2],
      ] as const) {
        const i0 = vLevel(fa, tier - 1);
        const i1 = vLevel(fb, tier - 1);
        const i2 = vAt(fb, zTag(tier, 0), zBase + GH);
        const i3 = vAt(fa, zTag(tier, 0), zBase + GH);
        b.quad(i0, i1, i2, i3);
        tris.push({ role: 'facet', cell: cellIdx }, { role: 'facet', cell: cellIdx });
      }
      // roof panels: curved sides A→C (tail A, head C = apex)
      const pa = generators(A1, C, Cop.sub(A1), C, Cop, zBase);
      const pb = generators(A2, C, Cop.sub(A2), C, Cop, zBase);
      for (let k = 0; k <= K; k++) {
        if (!pa[k]!.r.eq(pb[k]!.r)) throw new Error('liftVault: cell ridge mismatch');
      }
      emitStrips(pa, tier, 'roof', cellIdx);
      emitStrips(pb, tier, 'roof', cellIdx);
      noteEdge(A1, C, { spec, curved: true, from: C, to: A1, tail: A1, head: C });
      noteEdge(A2, C, { spec, curved: true, from: A2, to: C, tail: A2, head: C });
      if (n === 4) {
        noteEdge(A1, Cop, { spec, curved: false, from: A1, to: Cop });
        noteEdge(A2, Cop, { spec, curved: false, from: Cop, to: A2 });
      } else {
        noteEdge(A1, A2, { spec, curved: false, from: A1, to: A2 });
      }
    } else {
      // intermediate: curved sides C→A (tail C = the low point), fronts on
      // the backside path at the tier top
      if (n === 4) {
        const Kv = verts[(c + 2) % n]!;
        const pa = generators(C, A1, Kv.sub(A1), C, Kv, zBase);
        const pb = generators(C, A2, Kv.sub(A2), C, Kv, zBase);
        for (let k = 0; k <= K; k++) {
          if (!pa[k]!.r.eq(pb[k]!.r)) throw new Error('liftVault: intermediate ridge mismatch');
        }
        emitStrips(pa, tier, 'roof', cellIdx);
        emitStrips(pb, tier, 'roof', cellIdx);
        noteEdge(A1, Kv, { spec, curved: false, from: A1, to: Kv });
        noteEdge(A2, Kv, { spec, curved: false, from: Kv, to: A2 });
      } else {
        const pa = generators(C, A1, A2.sub(A1), C, A2, zBase);
        emitStrips(pa, tier, 'roof', cellIdx);
        noteEdge(A1, A2, { spec, curved: false, from: A1, to: A2 });
      }
      noteEdge(C, A1, { spec, curved: true, from: C, to: A1, tail: C, head: A1 });
      noteEdge(C, A2, { spec, curved: true, from: A2, to: C, tail: C, head: A2 });
    }
  });

  /* ---------- pass 2: riser bands and boundary closures ----------
   *
   * Orientation is structural, not searched: panels and facets always
   * traverse their plan edges in face-CCW order (the projected-CCW rule
   * guarantees it), so every closure winds against the traversal of the
   * face that owns its open side. Vertical side edges follow the canonical
   * subdivision (tier levels, facet heights) so closures weld edge-for-edge.
   */

  /**
   * band between a crease polyline and a straight segment at level segLevel,
   * in the edge's vertical plane
   */
  const emitBand = (cu: SideUse, segLevel: number, cellIdx: number) => {
    const creaseTier = cu.spec.tier;
    const creaseTail = cu.tail!;
    const creaseHead = cu.head!;
    const zBase = (creaseTier - 1) * CELL_HEIGHT;
    const side = creaseHead.sub(creaseTail);
    const poly: number[] = us.map((uf, k) => {
      const q = creaseTail.add(side.scale(Q2.of(uf)));
      return vAt(q, zTag(creaseTier, k), zBase + profileHeight(uNum[k]!));
    });
    const segStart = vLevel(creaseTail, segLevel);
    const segEnd = vLevel(creaseHead, segLevel);
    // the owning panel traverses the crease (from → to); the band opposes it,
    // so it ascends tail→head exactly when the panel runs head→tail
    const flip = cu.from.eq(creaseTail);
    const fan = (x: number, y: number, z: number) => {
      if (x === y || y === z || x === z) return;
      if (flip) b.tri(x, z, y);
      else b.tri(x, y, z);
      tris.push({ role: 'wall', cell: cellIdx, src: `band:${creaseTier}:${segLevel}` });
    };
    for (let k = 0; k + 1 < poly.length; k++) fan(segStart, poly[k]!, poly[k + 1]!);
    if (segEnd !== poly[poly.length - 1]!) {
      // closing region spans a full tier at the head: split its vertical at
      // the facet height so it welds with facet corners and wall stacks
      const mid = vAt(creaseHead, zTag(creaseTier, 0), zBase + GH);
      fan(segStart, poly[poly.length - 1]!, mid);
      fan(segStart, mid, segEnd);
    }
  };

  /**
   * vertical wall between two tier levels over an edge, one tier at a time,
   * each tier split at its facet height; `from → to` is the traversal of the
   * face owning the wall's open top (its facet bottom or front top runs that
   * way, so the stack's top edge opposes it)
   */
  const emitWallStack = (from: Pt, to: Pt, loLevel: number, hiLevel: number, cellIdx: number) => {
    for (let m = loLevel; m < hiLevel; m++) {
      const z0 = m * CELL_HEIGHT;
      const a0 = vLevel(from, m);
      const b0 = vLevel(to, m);
      const aF = vAt(from, zTag(m + 1, 0), z0 + GH);
      const bF = vAt(to, zTag(m + 1, 0), z0 + GH);
      const a1 = vLevel(from, m + 1);
      const b1 = vLevel(to, m + 1);
      b.quad(a0, b0, bF, aF);
      b.quad(aF, bF, b1, a1);
      tris.push(
        { role: 'wall', cell: cellIdx, src: 'stack' },
        { role: 'wall', cell: cellIdx, src: 'stack' },
        { role: 'wall', cell: cellIdx, src: 'stack' },
        { role: 'wall', cell: cellIdx, src: 'stack' },
      );
    }
  };

  const closeBoundary = opts.closeBoundary ?? (() => true);

  for (const e of edgeUses.values()) {
    const curvedUses = e.uses.filter((u) => u.curved);
    const flatUses = e.uses.filter((u) => !u.curved);
    if (curvedUses.length === 2) {
      const [u1, u2] = curvedUses;
      if (u1!.spec.tier !== u2!.spec.tier || !u1!.tail!.eq(u2!.tail!)) {
        throw new Error('liftVault: curve-to-curve joint with mismatched tiers or tails');
      }
      continue; // welded by construction
    }
    if (curvedUses.length === 1) {
      const cu = curvedUses[0]!;
      const creaseTier = cu.spec.tier;
      if (flatUses.length === 1) {
        // back-on-curve: upper straight line over the lower crease
        const fu = flatUses[0]!;
        const level = fu.spec.type === 'cell' ? fu.spec.tier - 1 : fu.spec.tier;
        emitBand(cu, level, -1);
      } else if (flatUses.length === 0) {
        // boundary crease: wall stack to the tier base, band up to the crease
        if (closeBoundary(e.a, e.b)) {
          emitWallStack(cu.from, cu.to, 0, creaseTier - 1, -1);
          emitBand(cu, creaseTier - 1, -1);
        }
      }
      continue;
    }
    // no curved use
    if (flatUses.length === 2) {
      const [f1, f2] = flatUses;
      const lv = (u: SideUse) => (u.spec.type === 'cell' ? u.spec.tier - 1 : u.spec.tier);
      const l1 = lv(f1!);
      const l2 = lv(f2!);
      if (l1 !== l2) {
        const upper = l1 > l2 ? f1! : f2!;
        emitWallStack(upper.from, upper.to, Math.min(l1, l2), Math.max(l1, l2), -1);
      }
    } else if (flatUses.length === 1) {
      const fu = flatUses[0]!;
      const lv = fu.spec.type === 'cell' ? fu.spec.tier - 1 : fu.spec.tier;
      if (lv !== 0 && closeBoundary(e.a, e.b)) emitWallStack(fu.from, fu.to, 0, lv, -1);
    }
  }

  return { mesh: b.build(), tris };
}
