import { describe, expect, it } from 'vitest';
import { Frac } from './frac.js';
import { Q2 } from './q2.js';

describe('Frac', () => {
  it('normalizes', () => {
    expect(Frac.of(2, 4).eq(Frac.of(1, 2))).toBe(true);
    expect(Frac.of(-2, -4).eq(Frac.of(1, 2))).toBe(true);
    expect(Frac.of(2, -4).eq(Frac.of(-1, 2))).toBe(true);
    expect(Frac.of(0, 7).eq(Frac.ZERO)).toBe(true);
  });
  it('arithmetic', () => {
    const a = Frac.of(1, 3);
    const b = Frac.of(1, 6);
    expect(a.add(b).eq(Frac.of(1, 2))).toBe(true);
    expect(a.sub(b).eq(Frac.of(1, 6))).toBe(true);
    expect(a.mul(b).eq(Frac.of(1, 18))).toBe(true);
    expect(a.div(b).eq(Frac.of(2))).toBe(true);
  });
});

describe('Q2 = ℚ(√2)', () => {
  const n = (x: Q2) => x.toNumber();

  it('field operations agree with floating point', () => {
    const xs = [Q2.of(3, -2), Q2.of(-1, 1), Q2.frac(5, 7), Q2.SQRT2_HALF, Q2.SQRT2_M1];
    for (const x of xs) {
      for (const y of xs) {
        expect(n(x.add(y))).toBeCloseTo(n(x) + n(y), 12);
        expect(n(x.sub(y))).toBeCloseTo(n(x) - n(y), 12);
        expect(n(x.mul(y))).toBeCloseTo(n(x) * n(y), 12);
        if (!y.isZero()) expect(n(x.div(y))).toBeCloseTo(n(x) / n(y), 12);
      }
    }
  });

  it('inverse round-trips', () => {
    const x = Q2.of(Frac.of(3, 7), Frac.of(-2, 5));
    expect(x.mul(x.inv()).eq(Q2.ONE)).toBe(true);
  });

  it('exact sign for mixed-sign a + b√2', () => {
    expect(Q2.of(3, -2).sign()).toBe(1); // 3 − 2√2 ≈ 0.17
    expect(Q2.of(-3, 2).sign()).toBe(-1); // −3 + 2√2 ≈ −0.17
    expect(Q2.of(2, -1).sign()).toBe(1); // 2 − √2 ≈ 0.59
    expect(Q2.of(-2, 1).sign()).toBe(-1);
    expect(Q2.of(1, -1).sign()).toBe(-1); // 1 − √2 < 0
    expect(Q2.of(-1, 1).sign()).toBe(1);
    expect(Q2.ZERO.sign()).toBe(0);
    // a² = 2b² only when both are zero — √2 is irrational; near-tie cases:
    expect(Q2.of(7, -5).sign()).toBe(-1); // 7 − 5√2 ≈ −0.07
    expect(Q2.of(17, -12).sign()).toBe(1); // 17 − 12√2 ≈ 0.03
  });

  it('ordering matches numeric ordering', () => {
    const xs = [Q2.of(3, -2), Q2.of(-1, 1), Q2.frac(-5, 7), Q2.SQRT2_M1, Q2.ONE, Q2.of(17, -12)];
    const sortedExact = [...xs].sort((p, q) => p.cmp(q));
    const sortedFloat = [...xs].sort((p, q) => n(p) - n(q));
    expect(sortedExact.map(n)).toEqual(sortedFloat.map(n));
  });
});
