/**
 * Al-Kāshī's profile curve — "the method of the masons" (Miftāḥ al-Ḥisāb
 * IV.9; Dold-Samplonius, Centaurus 35 (1992), 220–223; Harmsen, diss.
 * Heidelberg 2006, 78–79). Reproduced as a construction, not a spline fit.
 *
 * The curve lives in a rectangle one module wide and TWO modules tall — the
 * 1:2 proportion confirmed by the prefabricated cells excavated at Takht-i
 * Sulaymān, whose heights are exactly twice their module. Coordinates here:
 * x runs from the facet plane (0) toward the apex side (m), z from the tier
 * base (0) to the cell top (2m). A = (m, 2m) is the top corner over the apex.
 *
 *   1. Strike the oblique AE at 30° below the upper line, meeting the facet
 *      vertical at E = (0, 2m − m·tan 30°).
 *   2. Divide AE into five equal parts; Z is the mark three fifths from A.
 *   3. Rotate the remaining two fifths, EZ, about E down onto the vertical:
 *      H = (0, E_z − |EZ|). THE FACTOR is the vertical distance from the
 *      base up to H, where the curve begins:
 *          factor = (2 − (3/5)√3)·m ≈ 0.9607695·m
 *      (the manuscript's 0;57,38,43,14 ≈ 0.9607556, against Dold-Samplonius's
 *      recalculated 0;57,38,46,12 — she isolates the coefficient discrepancy
 *      here, and reads it as a mason's working value rather than a plain
 *      miscalculation; pp. 223, 234).
 *   4. The arc H→Z is "without any doubt one sixth of the circumference":
 *      its centre T completes the equilateral triangle Z–H–T, so
 *      T = (4m/5, factor) and the radius is exactly 4m/5.
 *
 * The profile, base to top: vertical facet G→H, 60° arc H→Z, straight 30°
 * ramp Z→A. The 30° oblique is precisely what makes it tangent-continuous:
 * the arc leaves the facet vertically at H and meets the ramp tangentially
 * at Z. (An earlier reading here — rotation about the top corner, one arc to
 * a flat crown — was wrong on both counts.)
 *
 * Surface bookkeeping that hangs off the curve (Dold-Samplonius 216–223):
 *   curve length  AZH = |AZ| + arc = (2√3/5 + 4π/15)·m ≈ 1.5305783·m
 *   curving factor    = AZH/2 ≈ 0.7652891·m        (al-Kāshī 0;45,55,2,27)
 *   coefficient (taʿdīl) = factor + curving factor ≈ 1.7260586·m
 *                                       (al-Kāshī 1;43,33,45,41 = 1.726045)
 * A cell's surface ≈ (sum of its facet bases) × coefficient — see measure.ts.
 *
 * Al-Kāshī's vault-fitting mechanism: the foot GH "may be shortened or
 * lengthened when they put it behind the arch, in order that it fits," and
 * the coefficient changes by the same amount (transl. p. 234). Exposed as
 * `footAdjustment`; the curved part above the foot is rigid.
 */

export interface KashiConstruction {
  readonly A: readonly [number, number];
  readonly E: readonly [number, number];
  readonly Z: readonly [number, number];
  readonly H: readonly [number, number];
  readonly T: readonly [number, number];
  /** The four interior division marks on the oblique AE. */
  readonly divisions: ReadonlyArray<readonly [number, number]>;
}

export interface RoofArc {
  readonly cx: number;
  readonly cz: number;
  readonly r: number;
  /** Radians; a0 at H (180°), a1 at Z (120°). */
  readonly a0: number;
  readonly a1: number;
}

export interface KashiProfile {
  readonly module: number;
  /** 2·module + footAdjustment. */
  readonly height: number;
  /** Facet height GH — "the factor". */
  readonly factor: number;
  /** |AZ| + arc HZ: the length of the curved part, rigid under foot adjustment. */
  readonly curveLength: number;
  /** Half the curve length — multiplies biped perpendiculars in the Shīrāzī method. */
  readonly curvingFactor: number;
  /** factor + curvingFactor: al-Kāshī's taʿdīl, the per-facet-base surface multiplier. */
  readonly coefficient: number;
  readonly construction: KashiConstruction;
  readonly arc: RoofArc;
  /** Point at t ∈ [0,1] along the profile (facet → arc → ramp), by arc length. */
  sample(t: number): [number, number];
  polyline(arcSamples?: number): Array<[number, number]>;
}

export interface KashiProfileOptions {
  readonly module?: number;
  /** Lengthen (+) or shorten (−) the vertical foot; coefficient shifts equally. */
  readonly footAdjustment?: number;
}

/** The factor per unit module, exact: 2 − (3/5)√3. */
export const FACTOR_PER_MODULE = 2 - (3 / 5) * Math.sqrt(3);
/** Curve length AZH per unit module: 2√3/5 + 4π/15. */
export const CURVE_LENGTH_PER_MODULE = (2 * Math.sqrt(3)) / 5 + (4 * Math.PI) / 15;
/** Curving factor per unit module: half the curve. */
export const CURVING_FACTOR_PER_MODULE = CURVE_LENGTH_PER_MODULE / 2;
/** The taʿdīl per unit module, exact geometric value ≈ 1.7260586 (al-Kāshī: 1.726045). */
export const COEFFICIENT_PER_MODULE = FACTOR_PER_MODULE + CURVING_FACTOR_PER_MODULE;

export function kashiProfile(opts: KashiProfileOptions = {}): KashiProfile {
  const m = opts.module ?? 1;
  const delta = opts.footAdjustment ?? 0;
  if (!(m > 0)) throw new Error('kashiProfile: module must be positive');

  const tan30 = Math.tan(Math.PI / 6);
  const baseFactor = FACTOR_PER_MODULE * m;
  const factor = baseFactor + delta;
  if (!(factor > 0)) throw new Error('kashiProfile: foot adjustment consumes the whole facet');
  const height = 2 * m + delta;

  // Construction points (z shifted by the foot adjustment; the curved part is rigid).
  const A: [number, number] = [m, height];
  const E: [number, number] = [0, height - m * tan30];
  const obliqueLen = m / Math.cos(Math.PI / 6);
  const divisions: Array<[number, number]> = [];
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    divisions.push([A[0] + (E[0] - A[0]) * t, A[1] + (E[1] - A[1]) * t]);
  }
  const Z: [number, number] = [A[0] + (E[0] - A[0]) * (3 / 5), A[1] + (E[1] - A[1]) * (3 / 5)];
  const H: [number, number] = [0, E[1] - (2 / 5) * obliqueLen];
  const r = (4 / 5) * m; // |ZH|, exactly
  const T: [number, number] = [r, H[1]];

  const a0 = Math.PI; // at H
  const a1 = (2 * Math.PI) / 3; // at Z: 60° of arc
  const arcLen = r * (a0 - a1);
  const rampLen = Math.hypot(A[0] - Z[0], A[1] - Z[1]); // |AZ| = 2√3/5·m
  const curveLength = arcLen + rampLen;
  const curvingFactor = curveLength / 2;
  const coefficient = factor + curvingFactor;

  const total = factor + curveLength;
  const sample = (t: number): [number, number] => {
    const s = Math.min(Math.max(t, 0), 1) * total;
    if (s <= factor) return [0, s];
    const s2 = s - factor;
    if (s2 <= arcLen) {
      const a = a0 - s2 / r;
      return [T[0] + r * Math.cos(a), T[1] + r * Math.sin(a)];
    }
    const u = (s2 - arcLen) / rampLen;
    return [Z[0] + (A[0] - Z[0]) * u, Z[1] + (A[1] - Z[1]) * u];
  };

  return {
    module: m,
    height,
    factor,
    curveLength,
    curvingFactor,
    coefficient,
    construction: { A, E, Z, H, T, divisions },
    arc: { cx: T[0], cz: T[1], r, a0, a1 },
    sample,
    polyline(arcSamples = 24) {
      const pts: Array<[number, number]> = [[0, 0], [...H]];
      for (let i = 1; i <= arcSamples; i++) {
        const a = a0 - ((a0 - a1) * i) / arcSamples;
        pts.push([T[0] + r * Math.cos(a), T[1] + r * Math.sin(a)]);
      }
      pts.push([...A]);
      return pts;
    },
  };
}
