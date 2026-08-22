import { EXACT_AREAS, type ElementKind } from './elements.js';

/**
 * Al-Kāshī's surface measurement of the muqarnas (Miftāḥ al-Ḥisāb IV.9,
 * transl. Dold-Samplonius, Centaurus 35 (1992), 226–236). This module is the
 * historical computation itself — the independent path the mesh oracle
 * checks against.
 *
 * CURVED type: every cell contributes (sum of its facet bases) × the
 * coefficient (taʿdīl ≈ 1.726045 per unit module, see profile.ts); a cell's
 * facets stand on its backside edges, so the base total is fixed by the plan
 * shape it stands on. Curved intermediate elements are added per piece with
 * al-Kāshī's four constants — which Dold-Samplonius could not derive from
 * the curve ("How al-Kāshī reached his values I do not know," p. 225), so
 * they are encoded exactly as given.
 *
 * SIMPLE / clay-plastered types: facets = (sum of facet bases) × facet
 * height (default one module); roofs are counted as their plane plan areas —
 * al-Kāshī's own flat-roof approximation. His roof table is numerically the
 * exact plan areas of the alphabet, which doubles as a check on our
 * constructions.
 */

/** Sexagesimal fraction, e.g. "1;43,33,45,41" → 1.726045. */
export function sexagesimal(s: string): number {
  const [whole, frac] = s.split(';');
  let value = Number(whole);
  if (Number.isNaN(value)) throw new Error(`sexagesimal: bad value ${s}`);
  if (frac !== undefined && frac.length > 0) {
    const digits = frac.split(',').map((d) => Number(d));
    let scale = 1;
    for (const d of digits) {
      if (Number.isNaN(d) || d < 0 || d >= 60) throw new Error(`sexagesimal: bad digit in ${s}`);
      scale /= 60;
      value += d * scale;
    }
  }
  return value;
}

/**
 * Al-Kāshī's own table (Leiden ms. Or. 185, via DS 1992 p. 236), sexagesimal.
 * The octagon-side entry prints with one corrupt digit (59 for 19); the
 * corrected value is used, the ms reading kept in the comment.
 */
export const ALKASHI_TABLE = {
  factor: '0;57,38,43,14',
  curvingFactor: '0;45,55,2,27',
  coefficient: '1;43,33,45,41',
  facetBaseHalfSquare: '0;42,25,35,4', // √2/2, per half-diagonal
  facetBaseAlmondOrBiped: '0;24,51,10,8', // √2−1
  facetBaseOctagonSide: '0;45,55,19,55', // 2·sin 22.5° (ms prints 0;45,55,59,55)
  roofSquare: '1',
  roofRhombus: '0;42,25,35,4',
  roofAlmond: '0;24,51,10,8',
  roofHalfRhombus: '0;21,12,47,32',
  roofBiped: '0;17,34,24,36',
  roofHalfSquare: '0;30',
  intermediateTriangle: '0;34,1,38,55',
  intermediateSmallBiped: '0;36,37,10,56',
  intermediateLargeBiped: '1;0,52,5,59',
  intermediateAlmond: '0;38,1,21,3',
} as const;

/** The taʿdīl as al-Kāshī states it, per unit module. */
export const ALKASHI_COEFFICIENT = sexagesimal(ALKASHI_TABLE.coefficient);

/** Plan shapes a curved-type cell can stand on. */
export type CellBase =
  | 'square'
  | 'rhombus'
  | 'half-square'
  | 'half-rhombus'
  | 'almond'
  | 'small-biped'
  | 'jug';

/**
 * Total facet base per cell, in modules: the summed lengths of the backside
 * edges the two facets stand on. Only four distinct base values occur in the
 * curved type, as al-Kāshī remarks: 1, √2/2, √2−1, and the octagon side.
 */
export const CELL_FACET_BASE: Record<CellBase, number> = {
  square: 2,
  rhombus: 2,
  'half-square': Math.SQRT2, // two half-diagonals meeting at 180°
  'half-rhombus': 2 * Math.sin(Math.PI / 8), // its base, the rhombus's short diagonal
  almond: 2 * (Math.SQRT2 - 1),
  'small-biped': 2 * (Math.SQRT2 - 1), // the Seljuk role swap
  jug: 4 * Math.sin(Math.PI / 8), // two octagon sides
};

/** Curved intermediate kinds priced by al-Kāshī's per-piece constants. */
export type CurvedIntermediate = 'triangle' | 'small-biped' | 'large-biped' | 'almond';

export const CURVED_INTERMEDIATE_AREA: Record<CurvedIntermediate, number> = {
  triangle: sexagesimal(ALKASHI_TABLE.intermediateTriangle),
  'small-biped': sexagesimal(ALKASHI_TABLE.intermediateSmallBiped),
  'large-biped': sexagesimal(ALKASHI_TABLE.intermediateLargeBiped),
  almond: sexagesimal(ALKASHI_TABLE.intermediateAlmond),
};

export interface CurvedCounts {
  readonly cells?: Partial<Record<CellBase, number>>;
  readonly intermediates?: Partial<Record<CurvedIntermediate, number>>;
}

export interface CurvedMeasure {
  readonly facetBaseSum: number;
  readonly cellArea: number;
  readonly intermediateArea: number;
  readonly total: number;
}

export interface MeasureOptions {
  readonly module?: number;
  /** Per-module coefficient; defaults to al-Kāshī's own 1.726045. */
  readonly coefficient?: number;
}

/** Al-Kāshī's measurement of a curved muqarnas from element counts. */
export function measureCurved(counts: CurvedCounts, opts: MeasureOptions = {}): CurvedMeasure {
  const m = opts.module ?? 1;
  const coefficient = opts.coefficient ?? ALKASHI_COEFFICIENT;
  let facetBaseSum = 0;
  for (const [base, n] of Object.entries(counts.cells ?? {})) {
    facetBaseSum += CELL_FACET_BASE[base as CellBase] * (n ?? 0);
  }
  let intermediateArea = 0;
  for (const [kind, n] of Object.entries(counts.intermediates ?? {})) {
    intermediateArea += CURVED_INTERMEDIATE_AREA[kind as CurvedIntermediate] * (n ?? 0);
  }
  const cellArea = facetBaseSum * coefficient;
  return {
    facetBaseSum: facetBaseSum * m,
    cellArea: cellArea * m * m,
    intermediateArea: intermediateArea * m * m,
    total: (cellArea + intermediateArea) * m * m,
  };
}

export interface SimpleTier {
  /** Summed facet bases of the tier, in modules. */
  readonly facetBaseSum: number;
  /** Roof counts by plan shape, priced at plane plan areas. */
  readonly roofs?: Partial<Record<ElementKind, number>>;
  /** Facet height in modules; al-Kāshī: "in most cases the amount of the module". */
  readonly facetHeight?: number;
}

/** Al-Kāshī's measurement of a simple (or clay-plastered) muqarnas, tier by tier. */
export function measureSimple(tiers: readonly SimpleTier[], opts: { module?: number } = {}): number {
  const m = opts.module ?? 1;
  let total = 0;
  for (const tier of tiers) {
    total += tier.facetBaseSum * (tier.facetHeight ?? 1);
    for (const [kind, n] of Object.entries(tier.roofs ?? {})) {
      const area = EXACT_AREAS[kind];
      if (!area) throw new Error(`measureSimple: no plane roof area for ${kind}`);
      total += area.toNumber() * (n ?? 0);
    }
  }
  return total * m * m;
}
