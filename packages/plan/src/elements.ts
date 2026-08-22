import { Q2 } from './q2.js';
import { Iso, Pt, pt, lineIntersect, perp, signedArea2, dot2 } from './geom.js';

/**
 * The plan element alphabet, after al-Kāshī (Miftāḥ al-Ḥisāb IV.9) as read
 * by Dold-Samplonius (Centaurus 35, 1992) and Harmsen (diss. Heidelberg
 * 2006, ch. 2). Everything derives from two seeds at unit rib length — the
 * square and the 45°/135° rhombus — by bisection and complement. Nothing is
 * traced; every vertex is constructed. Plans are straight-edged: curvature
 * lives in the vertical dimension and projects to straight segments.
 *
 * Each element knows its CENTRAL NODE — the corner that becomes the cell's
 * apex — and its two CURVED SIDES, the module-length edges meeting there,
 * along which al-Kāshī's profile rises and neighbouring elements join. The
 * remaining edges are the backsides, where a cell's two facets stand. For
 * the square and the rhombus the shape fixes neither: their orientation is
 * decided at placement time by the muqarnas graph, so both fields are null.
 *
 * Roles (Il-Khanid corpus, Harmsen pp. 13–16): CELLS have facets and a
 * roof; INTERMEDIATE elements connect the roofs of adjacent cells. The jug
 * and almond serve only as cells, the bipeds only as intermediates; square
 * and rhombus serve as either; the halves mostly one but attested as both
 * (half-square cells in first tiers, occasionally intermediate; the
 * half-rhombus typically intermediate, but al-Kāshī prices its facet bases,
 * so cell use is legal here). The Seljuk almond/biped role swap is not
 * enabled in this default alphabet.
 */

export type ElementKind =
  | 'square'
  | 'half-square'
  | 'rhombus'
  | 'half-rhombus'
  | 'jug'
  | 'large-biped'
  | 'almond'
  | 'small-biped'
  | 'barley-kernel';

export type Role = 'cell' | 'intermediate';

export interface ElementDef {
  readonly kind: ElementKind;
  readonly roles: readonly Role[];
  /** CCW outline in canonical pose, unit module. */
  readonly verts: readonly Pt[];
  /**
   * Edge indices of the two curved sides (edge i runs verts[i] → verts[i+1]),
   * or null when the placement decides (square, rhombus).
   */
  readonly curvedSides: readonly [number, number] | null;
  /** Vertex index of the central node — the apex corner — or null as above. */
  readonly centralNode: number | null;
  /** Human-readable constructive derivation (feeds scene 3). */
  readonly derivation: string;
}

/** The module in plan: one rib along +x. */
const U: Pt = pt(1, 0);
/** Unit vector at 45° — U turned one grid step. */
const V45: Pt = Iso.rotation(1).applyVec(U);

function def(
  kind: ElementKind,
  roles: Role[],
  verts: Pt[],
  curvedSides: [number, number] | null,
  centralNode: number | null,
  derivation: string,
): ElementDef {
  if (signedArea2(verts).sign() !== 1) {
    throw new Error(`element ${kind}: outline is not CCW`);
  }
  if ((curvedSides === null) !== (centralNode === null)) {
    throw new Error(`element ${kind}: curved sides and central node must be given together`);
  }
  if (curvedSides && centralNode !== null) {
    const n = verts.length;
    for (const e of curvedSides) {
      const a = verts[e]!;
      const b = verts[(e + 1) % n]!;
      const len2 = dot2(b.sub(a), b.sub(a));
      if (!len2.eq(Q2.ONE)) {
        throw new Error(`element ${kind}: curved side ${e} is not module length`);
      }
      if (e !== centralNode && (e + 1) % n !== centralNode) {
        throw new Error(`element ${kind}: curved side ${e} does not meet the central node`);
      }
    }
  }
  return { kind, roles, verts, curvedSides, centralNode, derivation };
}

/** Seed: the unit square (murabbaʿ). Orientation decided at placement. */
export function square(): ElementDef {
  const o = pt(0, 0);
  const b = U;
  const d = perp(U);
  return def(
    'square',
    ['cell', 'intermediate'],
    [o, b, b.add(d), d],
    null,
    null,
    'seed: unit rib, closed by right angles',
  );
}

/** Seed: the unit rhombus (muʿayyan), angles 45°/135°. Orientation decided at placement. */
export function rhombus(): ElementDef {
  const o = pt(0, 0);
  return def(
    'rhombus',
    ['cell', 'intermediate'],
    [o, U, U.add(V45), V45],
    null,
    null,
    'seed: unit rib and its 45° turn, closed as a parallelogram',
  );
}

/**
 * The square bisected along its diagonal. As a cell its facets stand on the
 * two half-diagonals, meeting at 180° (al-Kāshī); the legs are its curved
 * sides, meeting at the right angle.
 */
export function halfSquare(): ElementDef {
  const s = square().verts;
  return def(
    'half-square',
    ['cell', 'intermediate'],
    [s[0]!, s[1]!, s[2]!],
    [0, 1],
    1,
    'square bisected along the diagonal',
  );
}

/**
 * The rhombus bisected along its short diagonal: the isosceles triangle with
 * apex 45° (angles 45/67.5/67.5), unit sides curved, the short diagonal its
 * base.
 */
export function halfRhombus(): ElementDef {
  const r = rhombus().verts;
  return def(
    'half-rhombus',
    ['cell', 'intermediate'],
    [r[0]!, r[1]!, r[3]!],
    [0, 2],
    0,
    'rhombus bisected along its short diagonal',
  );
}

/**
 * The jug (barmak): a quarter of a regular octagon with circumradius equal
 * to the module, inscribed at a corner of the square. The two unit radii are
 * its curved sides; the two octagon sides its backsides. Cell only.
 */
export function jug(): ElementDef {
  const o = pt(0, 0);
  const v1 = U;
  const v3 = perp(U);
  const v2 = V45; // unit distance along the diagonal: the circumradius
  return def(
    'jug',
    ['cell'],
    [o, v1, v2, v3],
    [0, 3],
    0,
    'quarter of a regular octagon: unit radii along the square’s sides, apex at unit distance on the diagonal',
  );
}

/**
 * The large biped: what remains of the square when the jug is removed.
 * Intermediate only, generally paired with a jug; its curved sides are the
 * unit edges meeting at the square's far corner.
 */
export function largeBiped(): ElementDef {
  const s = square().verts;
  const v2 = jug().verts[2]!;
  return def(
    'large-biped',
    ['intermediate'],
    [s[1]!, s[2]!, s[3]!, v2],
    [0, 1],
    1,
    'square minus jug',
  );
}

/**
 * The almond (bādām): a deltoid with two unit sides meeting at 45° (its
 * curved sides), right angles at the flanks, 135° at the far vertex.
 * Constructed inside the rhombus: perpendiculars to the unit sides at their
 * far ends meet on the long diagonal. Cell only.
 */
export function almond(): ElementDef {
  const a = pt(0, 0);
  const b = U;
  const d = V45;
  const c = lineIntersect(b, perp(U), d, perp(V45));
  return def(
    'almond',
    ['cell'],
    [a, b, c, d],
    [0, 3],
    0,
    'in the rhombus: perpendiculars at the ends of the unit sides meet on the long diagonal',
  );
}

/**
 * The small biped: what remains of the rhombus when the almond is removed.
 * Intermediate only; curved sides are the unit edges at the rhombus's far
 * 45° corner.
 */
export function smallBiped(): ElementDef {
  const r = rhombus().verts;
  const c = almond().verts[2]!;
  return def(
    'small-biped',
    ['intermediate'],
    [r[1]!, r[2]!, r[3]!, c],
    [0, 1],
    1,
    'rhombus minus almond',
  );
}

/**
 * The alphabet. The barley kernel (top-tier filler: a kite with two opposite
 * equal obtuse angles, its two shorter sides the module, its diameters
 * "adapted to the vault" — i.e. parametric) is typed but not yet
 * constructed; it enters with the curved lift, where its free diameter has
 * something to adapt to.
 */
export const ALPHABET: ReadonlyMap<ElementKind, ElementDef> = new Map(
  [square(), halfSquare(), rhombus(), halfRhombus(), jug(), largeBiped(), almond(), smallBiped()].map(
    (d) => [d.kind, d],
  ),
);

export function element(kind: ElementKind): ElementDef {
  const d = ALPHABET.get(kind);
  if (!d) throw new Error(`element kind not constructed: ${kind}`);
  return d;
}

/** Exact areas, for reference and tests: both bipeds share 1 − √2/2. */
export const EXACT_AREAS: Record<string, Q2> = {
  square: Q2.ONE,
  'half-square': Q2.HALF,
  rhombus: Q2.SQRT2_HALF,
  'half-rhombus': Q2.SQRT2_HALF.div(Q2.TWO),
  jug: Q2.SQRT2_HALF,
  'large-biped': Q2.ONE.sub(Q2.SQRT2_HALF),
  almond: Q2.SQRT2_M1,
  'small-biped': Q2.ONE.sub(Q2.SQRT2_HALF),
};

/**
 * Squared diameters (central node → opposite node), after Harmsen's Table
 * 2.1: jug 1, almond sec²22.5° = 4−2√2, small biped and the rhombus's short
 * orientation 2−√2, large biped (√2−1)² = 3−2√2, square 2, rhombus long
 * orientation 2+√2. Exact in ℚ(√2).
 */
export const DIAMETER_SQ: Partial<Record<ElementKind, Q2>> = {
  jug: Q2.ONE,
  almond: Q2.of(4, -2),
  'small-biped': Q2.of(2, -1),
  'large-biped': Q2.of(3, -2),
};

/** Exact squared diameter from the outline, for quads with a fixed central node. */
export function diameterSq(d: ElementDef): Q2 | null {
  if (d.centralNode === null || d.verts.length !== 4) return null;
  const c = d.verts[d.centralNode]!;
  const o = d.verts[(d.centralNode + 2) % 4]!;
  const v = o.sub(c);
  return dot2(v, v);
}
