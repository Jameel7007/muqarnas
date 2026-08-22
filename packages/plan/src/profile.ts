/**
 * Al-Kāshī's profile construction (Miftāḥ al-Ḥisāb IV.9, after
 * Dold-Samplonius). Reproduced as a construction, not a spline fit.
 *
 * Elevation coordinates: x = plan depth (0 at the cell's inner edge, module m
 * at the outer rib), z = height above the tier base. Default tier height for
 * the curved type is one module, so the elevation is a square.
 *
 *   1. From the upper line, strike an oblique at 30° from the top outer
 *      corner, meeting the opposite (inner) vertical.
 *   2. Divide the oblique into five equal parts.
 *   3. Rotate two fifths of it down about the top outer corner until it lies
 *      on the outer vertical.
 *   4. The vertical distance from the base up to where the rotated segment
 *      ends — where the curve begins — is the FACTOR.
 *
 * factor F = h − (2/5)·(m / cos 30°) = m·(1 − 4√3/15) ≈ 0.538105·m  (h = m)
 *
 * Below the factor point the facet is a plane vertical band of height F; the
 * roof curve runs from the facet top (m, F) back and up to the inner top
 * corner (0, h), arriving tangent to the top line (a vertical start tangent
 * is impossible for a single arc that stays inside the elevation — it would
 * bulge above the tier top). The circular interpolation is our reading,
 * provisional until the source's own curve is extracted; the endpoints and
 * the factor are the construction's. The factor drives al-Kāshī's whole
 * surface computation, which is why it is a first-class result here.
 */

export interface KashiConstruction {
  /** Top outer corner, start of the oblique. */
  readonly obliqueFrom: readonly [number, number];
  /** Where the 30° oblique meets the inner vertical. */
  readonly obliqueTo: readonly [number, number];
  /** The four interior division points of the oblique (five equal parts). */
  readonly divisions: ReadonlyArray<readonly [number, number]>;
  /** End of the rotated two-fifths: (m, F). The curve begins here. */
  readonly factorPoint: readonly [number, number];
}

export interface RoofArc {
  readonly cx: number;
  readonly cz: number;
  readonly r: number;
  /** Start/end angles (radians); a0 at the facet top, a1 at the inner top corner. */
  readonly a0: number;
  readonly a1: number;
}

export interface KashiProfile {
  readonly module: number;
  readonly height: number;
  /** Height of the plane facet band — al-Kāshī's factor. */
  readonly factor: number;
  /** height − factor: the rise the roof curve covers. */
  readonly roofRise: number;
  readonly construction: KashiConstruction;
  readonly arc: RoofArc;
  /** Point on the roof curve, t ∈ [0,1] from facet top to inner top corner. */
  sampleRoof(t: number): [number, number];
  /** Full profile polyline from (m, 0) up the facet and along the roof to (0, h). */
  polyline(roofSamples?: number): Array<[number, number]>;
  roofArcLength(): number;
}

export interface KashiProfileOptions {
  readonly module?: number;
  /** Tier height; defaults to one module (curved type). */
  readonly height?: number;
  readonly obliqueDegrees?: number;
  readonly divisions?: number;
  readonly rotatedParts?: number;
}

export function kashiProfile(opts: KashiProfileOptions = {}): KashiProfile {
  const m = opts.module ?? 1;
  const h = opts.height ?? m;
  const obliqueDeg = opts.obliqueDegrees ?? 30;
  const parts = opts.divisions ?? 5;
  const rotated = opts.rotatedParts ?? 2;

  const theta = (obliqueDeg * Math.PI) / 180;
  const obliqueFrom: [number, number] = [m, h];
  const obliqueTo: [number, number] = [0, h - m * Math.tan(theta)];
  const obliqueLen = m / Math.cos(theta);
  const divisions: Array<[number, number]> = [];
  for (let i = 1; i < parts; i++) {
    const t = i / parts;
    divisions.push([
      obliqueFrom[0] + (obliqueTo[0] - obliqueFrom[0]) * t,
      obliqueFrom[1] + (obliqueTo[1] - obliqueFrom[1]) * t,
    ]);
  }

  const factor = h - (rotated / parts) * obliqueLen;
  if (factor <= 0) throw new Error('kashiProfile: degenerate — factor is not positive');
  const factorPoint: [number, number] = [m, factor];
  const roofRise = h - factor;

  // Circular roof arc, horizontal tangent at the crown corner (0, h):
  // center on the inner vertical, r from passing through the facet top.
  const r = (m * m + roofRise * roofRise) / (2 * roofRise);
  const cx = 0;
  const cz = h - r;
  const a0 = Math.atan2(factor - cz, m - cx);
  const a1 = Math.PI / 2;

  const sampleRoof = (t: number): [number, number] => {
    const a = a0 + (a1 - a0) * t;
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  };

  return {
    module: m,
    height: h,
    factor,
    roofRise,
    construction: { obliqueFrom, obliqueTo, divisions, factorPoint },
    arc: { cx, cz, r, a0, a1 },
    sampleRoof,
    polyline(roofSamples = 32) {
      const pts: Array<[number, number]> = [[m, 0], [m, factor]];
      for (let i = 1; i <= roofSamples; i++) pts.push(sampleRoof(i / roofSamples));
      return pts;
    },
    roofArcLength() {
      return r * (a1 - a0);
    },
  };
}

/** The factor per unit module for the default construction, in closed form: 1 − 4√3/15. */
export const FACTOR_PER_MODULE = 1 - (4 * Math.sqrt(3)) / 15;
