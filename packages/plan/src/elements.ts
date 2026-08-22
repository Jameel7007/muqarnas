import { Q2 } from './q2.js';
import { Iso, Pt, pt, lineIntersect, perp, signedArea2 } from './geom.js';

/**
 * The plan element alphabet, after al-Kāshī (Miftāḥ al-Ḥisāb IV.9) as read by
 * Dold-Samplonius and Harmsen. Everything derives from two seeds at unit rib
 * length — the square and the 45°/135° rhombus — by bisection and
 * complement. Nothing here is traced; every vertex is constructed.
 *
 * Al-Kāshī distinguishes CELLS (structural units with a facet and a roof)
 * from INTERMEDIATE elements (connectors between adjacent cells, no roof of
 * their own). `roles` records which uses are legal for each shape; placing an
 * element in an illegal role is rejected at construction time (see plan.ts).
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
   * Indices of edges (edge i runs verts[i] → verts[i+1 mod n]) that plans
   * conventionally draw as arcs. Tiling mathematics always uses the straight
   * chords (Harmsen's convention); curvature belongs to rendering and to the
   * 3D lift.
   */
  readonly curvedEdges: readonly number[];
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
  curvedEdges: number[],
  derivation: string,
): ElementDef {
  if (signedArea2(verts).sign() !== 1) {
    throw new Error(`element ${kind}: outline is not CCW`);
  }
  return { kind, roles, verts, curvedEdges, derivation };
}

/** Seed: the unit square (murabbaʿ). */
export function square(): ElementDef {
  const o = pt(0, 0);
  const b = U;
  const d = perp(U);
  return def(
    'square',
    ['cell', 'intermediate'],
    [o, b, b.add(d), d],
    [],
    'seed: unit rib, closed by right angles',
  );
}

/** Seed: the unit rhombus (muʿayyan), angles 45°/135°. */
export function rhombus(): ElementDef {
  const o = pt(0, 0);
  return def(
    'rhombus',
    ['cell', 'intermediate'],
    [o, U, U.add(V45), V45],
    [],
    'seed: unit rib and its 45° turn, closed as a parallelogram',
  );
}

/** The square bisected along its diagonal. */
export function halfSquare(): ElementDef {
  const s = square().verts;
  return def(
    'half-square',
    ['cell'],
    [s[0]!, s[1]!, s[2]!],
    [],
    'square bisected along the diagonal',
  );
}

/**
 * The rhombus bisected along its short diagonal, giving the isosceles
 * triangle with apex 45° (angles 45/67.5/67.5).
 */
export function halfRhombus(): ElementDef {
  const r = rhombus().verts;
  return def(
    'half-rhombus',
    ['cell'],
    [r[0]!, r[1]!, r[3]!],
    [],
    'rhombus bisected along its short diagonal',
  );
}

/**
 * The jug (barmak): a quarter of a regular octagon, inscribed at a corner of
 * the square. Two unit ribs (the octagon radii, along the square's sides) and
 * two octagon sides; the short diagonal — corner to the far vertex, along the
 * square's diagonal — has unit length. Cell only.
 */
export function jug(): ElementDef {
  const o = pt(0, 0);
  const v1 = U;
  const v3 = perp(U);
  const v2 = V45; // unit distance along the diagonal: the octagon's circumradius
  return def(
    'jug',
    ['cell'],
    [o, v1, v2, v3],
    [1, 2],
    'quarter of a regular octagon: unit radii along the square’s sides, apex at unit distance on the diagonal',
  );
}

/** The large biped: what remains of the square when the jug is removed. Intermediate only. */
export function largeBiped(): ElementDef {
  const s = square().verts;
  const v2 = jug().verts[2]!;
  return def(
    'large-biped',
    ['intermediate'],
    [s[1]!, s[2]!, s[3]!, v2],
    [2, 3],
    'square minus jug',
  );
}

/**
 * The almond (bādām): a deltoid with two unit sides meeting at 45°, right
 * angles at the flanks, 135° at the far vertex. Constructed inside the
 * rhombus: erect perpendiculars to the two unit sides at their far ends;
 * they meet at the fourth vertex, which lands on the long diagonal.
 * The two unit sides are conventionally drawn curved.
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
    'in the rhombus: perpendiculars at the ends of the unit sides meet on the long diagonal',
  );
}

/** The small biped: what remains of the rhombus when the almond is removed. Intermediate only. */
export function smallBiped(): ElementDef {
  const r = rhombus().verts;
  const c = almond().verts[2]!;
  return def(
    'small-biped',
    ['intermediate'],
    [r[1]!, r[2]!, r[3]!, c],
    [],
    'rhombus minus almond',
  );
}

/**
 * The nine-shape alphabet. The barley kernel (a narrow lens, occasional in
 * the sources) is typed but not yet constructed: its exact measures are
 * pending extraction from Harmsen's catalogue, and guessing them would
 * violate the derive-everything rule.
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
