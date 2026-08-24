import { describe, expect, it } from 'vitest';
import { DAY_RAKE, DAY_START_DEG, dayAzimuth, dayElevation, dayState } from './scene8.js';

/**
 * LIGHTING.md's lock, as a test: in scene 8 nothing moves except the
 * rake key's azimuth. Any other field changing across the day is a bug
 * in the lighting language's terms.
 */

describe('scene 8 — the day', () => {
  it('leaves scene 7 at its hour and returns to it after one full turn', () => {
    expect(dayAzimuth(0)).toBe(DAY_START_DEG);
    expect(dayAzimuth(1)).toBe(DAY_START_DEG + 360);
    expect(((dayAzimuth(1) % 360) + 360) % 360).toBe(((DAY_START_DEG % 360) + 360) % 360);
  });

  it('the sun only ever walks forward', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const a = dayAzimuth(i / 200);
      expect(a).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = a;
    }
  });

  it('nothing moves except the sun — every non-sun field holds the day-rake', () => {
    for (const p of [0, 0.1, 0.33, 0.5, 0.77, 0.94, 1]) {
      const s = dayState(p);
      const { azimuthDeg: _a, elevationDeg: _e, ...sunRest } = s.sun;
      const { azimuthDeg: _b, elevationDeg: _f, ...daySunRest } = DAY_RAKE.sun;
      expect(sunRest).toEqual(daySunRest);
      expect(s.exposure).toBe(DAY_RAKE.exposure);
      expect(s.hemisphere).toEqual(DAY_RAKE.hemisphere);
      expect(s.fill).toEqual(DAY_RAKE.fill);
    }
  });

  it('the sun climbs through noon and returns, never above the language', () => {
    const base = DAY_RAKE.sun.elevationDeg;
    expect(dayElevation(0)).toBeCloseTo(base, 9);
    expect(dayElevation(1)).toBeCloseTo(base, 9);
    for (let i = 0; i <= 100; i++) {
      const e = dayElevation(i / 100);
      expect(e).toBeGreaterThanOrEqual(base - 1e-9);
      expect(e).toBeLessThanOrEqual(base + 6.5 + 1e-9);
      expect(e).toBeLessThan(0); // the key never rises above the horizontal
    }
  });
});
