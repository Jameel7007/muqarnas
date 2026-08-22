import { describe, expect, it } from 'vitest';
import { Q2 } from './q2.js';
import {
  Iso,
  Pt,
  pt,
  angleUnits,
  area,
  interiorAngleUnits,
  lineIntersect,
  onSegmentStrict,
  perp,
  signedArea2,
} from './geom.js';

/** Exact direction vector at k·22.5°, k = 0..15 (length varies, direction exact). */
function dir(k: number): Pt {
  const base = k % 2 === 0 ? pt(1, 0) : new Pt(Q2.ONE, Q2.SQRT2_M1); // 0° or 22.5°
  return Iso.rotation((k - (k % 2)) / 2).applyVec(base);
}

describe('Iso', () => {
  it('eight 45° rotations compose to the identity', () => {
    let p = pt(3, 5);
    for (let i = 0; i < 8; i++) p = Iso.rotation(1).apply(p);
    expect(p.eq(pt(3, 5))).toBe(true);
  });
  it('rotations are direct, reflections are not, both preserve area', () => {
    const poly = [pt(0, 0), pt(2, 0), pt(2, 1), pt(0, 1)];
    for (let k = 0; k < 8; k++) {
      const r = Iso.rotation(k);
      const m = Iso.reflection(k);
      expect(r.isDirect()).toBe(true);
      expect(m.isDirect()).toBe(false);
      expect(area(poly.map((p) => r.apply(p))).eq(area(poly))).toBe(true);
      expect(area(poly.map((p) => m.apply(p))).eq(area(poly))).toBe(true);
    }
  });
  it('reflections are involutions', () => {
    const p = pt(3, 5);
    for (let k = 0; k < 8; k++) {
      expect(Iso.reflection(k).apply(Iso.reflection(k).apply(p)).eq(p)).toBe(true);
    }
  });
  it('reflection across the 45° diagonal swaps coordinates', () => {
    expect(Iso.reflection(2).apply(pt(3, 5)).eq(pt(5, 3))).toBe(true);
  });
  it('then() composes in application order', () => {
    const t = Iso.rotation(2).then(Iso.translation(pt(1, 0)));
    // rotate (1,0) by 90° → (0,1), then translate → (1,1)
    expect(t.apply(pt(1, 0)).eq(pt(1, 1))).toBe(true);
  });
});

describe('angles on the 22.5° grid', () => {
  it('angleUnits recovers every pair of grid directions exactly', () => {
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        expect(angleUnits(dir(i), dir(j))).toBe((j - i + 16) % 16);
      }
    }
  });
  it('rejects off-grid angles', () => {
    expect(() => angleUnits(pt(1, 0), pt(3, 1))).toThrow();
  });
  it('interior angles of the square are four right angles', () => {
    const sq = [pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)];
    for (let i = 0; i < 4; i++) expect(interiorAngleUnits(sq, i)).toBe(4);
  });
});

describe('polygon and segment primitives', () => {
  it('signed area orientation', () => {
    const ccw = [pt(0, 0), pt(1, 0), pt(1, 1)];
    expect(signedArea2(ccw).sign()).toBe(1);
    expect(signedArea2([...ccw].reverse()).sign()).toBe(-1);
  });
  it('lineIntersect solves exactly', () => {
    const p = lineIntersect(pt(1, 0), perp(pt(1, 0)), pt(0, 0), pt(1, 1));
    expect(p.eq(pt(1, 1))).toBe(true);
  });
  it('onSegmentStrict excludes endpoints and off-line points', () => {
    const a = pt(0, 0);
    const b = pt(2, 2);
    expect(onSegmentStrict(pt(1, 1), a, b)).toBe(true);
    expect(onSegmentStrict(a, a, b)).toBe(false);
    expect(onSegmentStrict(b, a, b)).toBe(false);
    expect(onSegmentStrict(pt(1, 0), a, b)).toBe(false);
    // the √2 = 1 + (√2−1) split point on a diagonal: exact collinearity
    const s = new Pt(Q2.SQRT2_HALF, Q2.SQRT2_HALF);
    expect(onSegmentStrict(s, a, pt(1, 1))).toBe(true);
  });
});
