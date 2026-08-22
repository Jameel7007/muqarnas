import { describe, expect, it } from 'vitest';
import {
  COEFFICIENT_PER_MODULE,
  CURVE_LENGTH_PER_MODULE,
  CURVING_FACTOR_PER_MODULE,
  FACTOR_PER_MODULE,
  kashiProfile,
} from './profile.js';
import { sexagesimal } from './measure.js';

describe('al-Kāshī’s profile construction (the method of the masons)', () => {
  const p = kashiProfile();

  it('the elevation is one module wide and two tall', () => {
    expect(p.height).toBeCloseTo(2, 12);
    expect(p.construction.A).toEqual([1, 2]);
  });

  it('the factor falls out of the construction: 2 − (3/5)√3 per module', () => {
    expect(p.factor).toBeCloseTo(FACTOR_PER_MODULE, 12);
    expect(p.factor).toBeCloseTo(2 - 0.6 * Math.sqrt(3), 12);
    expect(p.factor).toBeCloseTo(0.9607695154586736, 12);
  });

  it('agrees with al-Kāshī’s own sexagesimal factor to his precision', () => {
    // 0;57,38,43,14 — his value carries a small deficit (DS 1992, p. 223).
    expect(Math.abs(p.factor - sexagesimal('0;57,38,43,14'))).toBeLessThan(2e-5);
  });

  it('the oblique is 30° and divided into five parts', () => {
    const { A, E, divisions } = p.construction;
    expect((A[1] - E[1]) / (A[0] - E[0])).toBeCloseTo(Math.tan(Math.PI / 6), 12);
    expect(divisions.length).toBe(4);
    // Z is the third mark from A
    expect(p.construction.Z[0]).toBeCloseTo(divisions[2]![0], 12);
    expect(p.construction.Z[1]).toBeCloseTo(divisions[2]![1], 12);
  });

  it('Z, H, T form an equilateral triangle with side — and radius — exactly 4/5', () => {
    const { Z, H, T } = p.construction;
    const d = (a: readonly [number, number], b: readonly [number, number]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1]);
    expect(d(Z, H)).toBeCloseTo(0.8, 12);
    expect(d(Z, T)).toBeCloseTo(0.8, 12);
    expect(d(H, T)).toBeCloseTo(0.8, 12);
    expect(p.arc.r).toBeCloseTo(0.8, 12);
  });

  it('the arc is exactly one sixth of the circumference', () => {
    expect(p.arc.a0 - p.arc.a1).toBeCloseTo(Math.PI / 3, 12);
  });

  it('is tangent-continuous: vertical at H, meeting the 30° ramp at Z', () => {
    const { Z, H, T, A } = p.construction;
    // radius TH horizontal ⇒ tangent vertical at the facet top
    expect(T[1]).toBeCloseTo(H[1], 12);
    // tangent at Z (⊥ radius TZ) is parallel to ZA
    const rz = [Z[0] - T[0], Z[1] - T[1]];
    const ramp = [A[0] - Z[0], A[1] - Z[1]];
    expect(rz[0]! * ramp[0]! + rz[1]! * ramp[1]!).toBeCloseTo(0, 12);
  });

  it('the exact construction points', () => {
    const s3 = Math.sqrt(3);
    expect(p.construction.E[1]).toBeCloseTo(2 - 1 / s3, 12);
    expect(p.construction.Z).toEqual([expect.closeTo(0.4, 12), expect.closeTo(2 - s3 / 5, 12)]);
    expect(p.construction.H[1]).toBeCloseTo(2 - 0.6 * s3, 12);
    expect(p.construction.T).toEqual([expect.closeTo(0.8, 12), expect.closeTo(2 - 0.6 * s3, 12)]);
  });

  it('curve length, curving factor, and coefficient', () => {
    expect(p.curveLength).toBeCloseTo(CURVE_LENGTH_PER_MODULE, 12);
    expect(p.curveLength).toBeCloseTo((2 * Math.sqrt(3)) / 5 + (4 * Math.PI) / 15, 12);
    expect(p.curvingFactor).toBeCloseTo(CURVING_FACTOR_PER_MODULE, 12);
    expect(p.coefficient).toBeCloseTo(COEFFICIENT_PER_MODULE, 12);
    // against al-Kāshī's own table values
    expect(Math.abs(p.curvingFactor - sexagesimal('0;45,55,2,27'))).toBeLessThan(2e-6);
    expect(Math.abs(p.coefficient - sexagesimal('1;43,33,45,41'))).toBeLessThan(2e-5);
  });

  it('sample() runs base → facet top → arc → apex, monotone in x and z', () => {
    expect(p.sample(0)).toEqual([0, 0]);
    const [xa, za] = p.sample(1);
    expect(xa).toBeCloseTo(1, 12);
    expect(za).toBeCloseTo(2, 12);
    let [px, pz] = p.sample(0);
    for (let i = 1; i <= 512; i++) {
      const [x, z] = p.sample(i / 512);
      expect(x).toBeGreaterThanOrEqual(px - 1e-12);
      expect(z).toBeGreaterThanOrEqual(pz - 1e-12);
      expect(x).toBeLessThanOrEqual(1 + 1e-12);
      expect(z).toBeLessThanOrEqual(2 + 1e-12);
      [px, pz] = [x, z];
    }
  });

  it('scales with the module', () => {
    const p3 = kashiProfile({ module: 3 });
    expect(p3.factor).toBeCloseTo(3 * FACTOR_PER_MODULE, 12);
    expect(p3.height).toBeCloseTo(6, 12);
    expect(p3.arc.r).toBeCloseTo(2.4, 12);
    expect(p3.coefficient).toBeCloseTo(3 * COEFFICIENT_PER_MODULE, 12);
  });

  it('foot adjustment: the foot and coefficient shift equally, the curve is rigid', () => {
    const adj = kashiProfile({ footAdjustment: 0.25 });
    expect(adj.factor).toBeCloseTo(p.factor + 0.25, 12);
    expect(adj.height).toBeCloseTo(2.25, 12);
    expect(adj.coefficient).toBeCloseTo(p.coefficient + 0.25, 12);
    expect(adj.curveLength).toBeCloseTo(p.curveLength, 12);
    expect(adj.sample(1)[1]).toBeCloseTo(2.25, 12);
    expect(() => kashiProfile({ footAdjustment: -1 })).toThrow(/foot adjustment/);
  });
});
