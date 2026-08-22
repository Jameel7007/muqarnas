import { Iso, Pt, pt } from './geom.js';
import { place, unfold, dihedralIsos, type Plan } from './plan.js';

/**
 * A deliberately modest first vault: a square bay stepped in two tiers, all
 * squares and half-squares (al-Kāshī's simple type needs nothing more). It
 * exists to exercise the whole pipeline — wedge, kaleidoscope, exact cover —
 * end to end while the historically interesting plans (Takht-i Sulaymān) are
 * being sourced. Wedge = one eighth, reflected along the diagonal.
 */

/** One eighth of the plan: the wedge (0,0)–(2,0)–(2,2). */
export function gridVaultWedge(): Plan {
  const sector: Pt[] = [pt(0, 0), pt(2, 0), pt(2, 2)];
  return {
    sector,
    placed: [
      // Crown: half-square with its hypotenuse on the diagonal seam. Tier 2.
      place('half-square', 'cell', Iso.IDENTITY, 2),
      // Outer ring within the wedge. Tier 1.
      place('square', 'cell', Iso.translation(pt(1, 0)), 1),
      place('half-square', 'cell', Iso.translation(pt(1, 1)), 1),
    ],
  };
}

/** The full plan: eight copies of the wedge under the D4 kaleidoscope. */
export function gridVaultFull(): Plan {
  const fullSector: Pt[] = [pt(-2, -2), pt(2, -2), pt(2, 2), pt(-2, 2)];
  return unfold(gridVaultWedge(), dihedralIsos(4, 2), fullSector);
}
