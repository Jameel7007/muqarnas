import { describe, expect, it } from 'vitest';
import { FACTOR_PER_MODULE, kashiProfile } from './profile.js';

describe('al-Kāshī’s profile construction', () => {
  it('the factor falls out of the construction: 1 − 4√3/15 per module', () => {
    const p = kashiProfile();
    expect(p.factor).toBeCloseTo(FACTOR_PER_MODULE, 12);
    expect(p.factor).toBeCloseTo(1 - (4 * Math.sqrt(3)) / 15, 12);
    // ≈ 0.538120 — the sexagesimal check against al-Kāshī's own value is
    // added once the Centaurus paper's numbers are extracted.
    expect(p.factor).toBeCloseTo(0.5381197846, 9);
  });

  it('scales linearly with the module', () => {
    const p = kashiProfile({ module: 3.5 });
    expect(p.factor).toBeCloseTo(3.5 * FACTOR_PER_MODULE, 12);
    expect(p.height).toBeCloseTo(3.5, 12);
  });

  it('the oblique really is 30° over the elevation width', () => {
    const p = kashiProfile();
    const [x0, z0] = p.construction.obliqueFrom;
    const [x1, z1] = p.construction.obliqueTo;
    expect(Math.abs((z0 - z1) / (x0 - x1))).toBeCloseTo(Math.tan(Math.PI / 6), 12);
    expect(p.construction.divisions.length).toBe(4); // five equal parts
  });

  it('the roof arc runs from the facet top to the crown corner, meeting the top line flat', () => {
    const p = kashiProfile();
    const [xs, zs] = p.sampleRoof(0);
    expect(xs).toBeCloseTo(p.module, 12);
    expect(zs).toBeCloseTo(p.factor, 12);
    const [xe, ze] = p.sampleRoof(1);
    expect(xe).toBeCloseTo(0, 12);
    expect(ze).toBeCloseTo(p.height, 12);
    expect(p.arc.cx).toBeCloseTo(0, 12); // centre on the inner vertical ⇒ horizontal tangent at the crown
  });

  it('the roof arc stays inside the elevation box', () => {
    const p = kashiProfile();
    for (let i = 0; i <= 256; i++) {
      const [x, z] = p.sampleRoof(i / 256);
      expect(x).toBeGreaterThanOrEqual(-1e-12);
      expect(x).toBeLessThanOrEqual(p.module + 1e-12);
      expect(z).toBeGreaterThanOrEqual(p.factor - 1e-12);
      expect(z).toBeLessThanOrEqual(p.height + 1e-12);
    }
  });

  it('arc length agrees with a fine polyline of the arc', () => {
    const p = kashiProfile();
    const n = 4096;
    let len = 0;
    let prev = p.sampleRoof(0);
    for (let i = 1; i <= n; i++) {
      const cur = p.sampleRoof(i / n);
      len += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      prev = cur;
    }
    expect(p.roofArcLength()).toBeCloseTo(len, 6);
  });

  it('profile polyline is monotone in height', () => {
    const pts = kashiProfile().polyline(64);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]![1]).toBeGreaterThanOrEqual(pts[i - 1]![1] - 1e-12);
    }
  });
});
