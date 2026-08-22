import { Frac } from './frac.js';
import { Q2 } from './q2.js';
import { Iso, Pt } from './geom.js';
import { place, type Plan } from './plan.js';
import { PLATE_PLACEMENTS, PLATE_SECTOR } from './takht-plate-data.js';

/**
 * The Takht-i Sulaymān plate: the oldest known muqarnas plan (Ilkhanid,
 * before ca. 1276), a quarter-vault ground plan incised on a 50 cm gypsum
 * plate found in the palace ruins in 1968. Assembled here from the element
 * alphabet, with the arrangement taken from Harmsen's digitization of Harb's
 * reading (diss. 2006, fig. 5.17(a)) via `tools/digitize-plate.mjs`.
 *
 * Two documented departures from the incised lines, both source-grounded:
 *
 * 1. REGULARIZATION. The incised design absorbs a misfit: its regular
 *    content spans 7 + 3.5√2 ≈ 11.9497 modules against the plate's 12-module
 *    field, and the excess Δ = 5 − 3.5√2 ≈ 0.0503 (≈ 1.8 mm at the plate's
 *    3.5 cm module) hides in a bent band of semi-regular quadrangles running
 *    seam → central star → wall. The prefabricated cells excavated at the
 *    site are unit-regular, so the vault's plan is the regularized one; the
 *    plate's stretch is drafting accommodation. (The published description
 *    concedes "semi-regular quadrangles and isosceles triangles along the
 *    diagonal", and doubts the design was ever executed.)
 * 2. One hexagon on the diagonal is completed as two rhombi by restoring its
 *    missing drawn edge at the "six rhombi join" node — one of the removable
 *    diagonal nodes of the reconstruction analysis.
 *
 * Coordinates: the vault centre is the origin, the quarter lies in the
 * positive quadrant, outer walls at 7 + 3.5√2, symmetry diagonal Y = X.
 * Roles are placeholders (`cell`) until the tier interpretation lands.
 */

const lattice = ([a, b]: readonly [number, number]): Q2 => new Q2(Frac.of(a), Frac.of(b, 2));

const latticePt = (
  xy: readonly [readonly [number, number], readonly [number, number]],
): Pt => new Pt(lattice(xy[0]), lattice(xy[1]));

export function takhtPlate(): Plan {
  const placed = PLATE_PLACEMENTS.map((p) => {
    let iso = p.refl ? Iso.reflection(0) : Iso.IDENTITY;
    iso = iso.then(Iso.rotation(p.rot));
    iso = iso.then(Iso.translation(new Pt(lattice(p.tx), lattice(p.ty))));
    return place(p.kind, 'cell', iso);
  });
  return { sector: PLATE_SECTOR.map(latticePt), placed };
}

/** The regularized field span: 7 + 3.5√2 modules (the plate's field is 12). */
export const PLATE_FIELD_SPAN: Q2 = new Q2(Frac.of(7), Frac.of(7, 2));
