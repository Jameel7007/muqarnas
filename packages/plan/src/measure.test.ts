import { describe, expect, it } from 'vitest';
import { Q2 } from './q2.js';
import { EXACT_AREAS } from './elements.js';
import {
  ALKASHI_COEFFICIENT,
  ALKASHI_TABLE,
  CELL_FACET_BASE,
  CURVED_INTERMEDIATE_AREA,
  measureCurved,
  measureSimple,
  sexagesimal,
} from './measure.js';
import { COEFFICIENT_PER_MODULE } from './profile.js';

describe('sexagesimal fractions', () => {
  it('parses', () => {
    expect(sexagesimal('1;30')).toBeCloseTo(1.5, 12);
    expect(sexagesimal('0;30')).toBeCloseTo(0.5, 12);
    expect(sexagesimal('0;0,30')).toBeCloseTo(30 / 3600, 12);
    expect(sexagesimal('2')).toBe(2);
    expect(sexagesimal('1;43,33,45,41')).toBeCloseTo(1.7260449, 6);
    expect(() => sexagesimal('0;61')).toThrow();
  });
});

describe('al-Kāshī’s table against the constructed geometry', () => {
  it('his facet-base constants are the exact grid lengths', () => {
    expect(Math.abs(sexagesimal(ALKASHI_TABLE.facetBaseHalfSquare) - Math.SQRT2 / 2)).toBeLessThan(2e-6);
    expect(Math.abs(sexagesimal(ALKASHI_TABLE.facetBaseAlmondOrBiped) - (Math.SQRT2 - 1))).toBeLessThan(2e-6);
    // his octagon side carries its own last-digit rounding (0;45,55,19,55 vs
    // the exact 0;45,55,19,14) on top of the corrected third digit
    expect(
      Math.abs(sexagesimal(ALKASHI_TABLE.facetBaseOctagonSide) - 2 * Math.sin(Math.PI / 8)),
    ).toBeLessThan(5e-6);
  });

  it('his plane-roof table equals our constructed exact areas', () => {
    const pairs: Array<[string, Q2]> = [
      [ALKASHI_TABLE.roofSquare, EXACT_AREAS['square']!],
      [ALKASHI_TABLE.roofRhombus, EXACT_AREAS['rhombus']!],
      [ALKASHI_TABLE.roofAlmond, EXACT_AREAS['almond']!],
      [ALKASHI_TABLE.roofHalfRhombus, EXACT_AREAS['half-rhombus']!],
      [ALKASHI_TABLE.roofBiped, EXACT_AREAS['small-biped']!],
      [ALKASHI_TABLE.roofHalfSquare, EXACT_AREAS['half-square']!],
    ];
    for (const [sexa, exact] of pairs) {
      expect(Math.abs(sexagesimal(sexa) - exact.toNumber())).toBeLessThan(2e-6);
    }
  });

  it('his coefficient sits 1.4e-5 under the exact construction', () => {
    expect(ALKASHI_COEFFICIENT).toBeCloseTo(1.726045, 6);
    const diff = COEFFICIENT_PER_MODULE - ALKASHI_COEFFICIENT;
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThan(2e-5);
  });
});

describe('THE AL-KĀSHĪ ORACLE FIXTURES: his worked cell surfaces', () => {
  const one = (base: keyof typeof CELL_FACET_BASE) =>
    measureCurved({ cells: { [base]: 1 } }).total;

  it('cell on a square: 3.452090', () => {
    expect(one('square')).toBeCloseTo(3.45209, 4);
  });
  it('cell on a half-square: 2.441024', () => {
    expect(one('half-square')).toBeCloseTo(2.441024, 4);
  });
  it('cell on an almond: 1.429904', () => {
    expect(one('almond')).toBeCloseTo(1.429904, 4);
  });
  it('cell on a jug: 2.642122', () => {
    expect(one('jug')).toBeCloseTo(2.642122, 4);
  });

  it('curved intermediates are priced by his four constants', () => {
    const r = measureCurved({
      intermediates: { triangle: 1, 'small-biped': 1, 'large-biped': 1, almond: 1 },
    });
    expect(r.cellArea).toBe(0);
    expect(r.intermediateArea).toBeCloseTo(
      0.5671246 + 0.6103332 + 1.0144722 + 0.6337086,
      5,
    );
    expect(CURVED_INTERMEDIATE_AREA['large-biped']).toBeCloseTo(1.0144722, 5);
  });

  it('scales by the module squared (facet bases by the module)', () => {
    const r1 = measureCurved({ cells: { square: 3 } });
    const r2 = measureCurved({ cells: { square: 3 } }, { module: 2 });
    expect(r2.total).toBeCloseTo(4 * r1.total, 10);
    expect(r2.facetBaseSum).toBeCloseTo(2 * r1.facetBaseSum, 12);
  });

  it('the exact-geometry coefficient is available as an alternative', () => {
    const his = measureCurved({ cells: { square: 1 } }).total;
    const exact = measureCurved({ cells: { square: 1 } }, { coefficient: COEFFICIENT_PER_MODULE }).total;
    expect(exact).toBeGreaterThan(his);
    expect(exact - his).toBeLessThan(4e-5);
  });
});

describe('the simple type', () => {
  it('facets by height, roofs as plane areas', () => {
    const total = measureSimple([
      { facetBaseSum: 4, roofs: { square: 2 } }, // 4·1 + 2·1
      { facetBaseSum: 2, roofs: { rhombus: 2 }, facetHeight: 0.5 }, // 1 + √2
    ]);
    expect(total).toBeCloseTo(4 + 2 + 1 + Math.SQRT2, 10);
  });
  it('module scaling', () => {
    const t = [{ facetBaseSum: 2, roofs: { square: 1 } }];
    expect(measureSimple(t, { module: 3 })).toBeCloseTo(9 * measureSimple(t), 10);
  });
});
