import { describe, expect, it } from 'vitest';
import { DAY_RAKE, DAY_START_DEG, dayAzimuth, dayState } from './scene8.js';

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

  it('nothing moves except the azimuth — every other field holds the day-rake', () => {
    for (const p of [0, 0.1, 0.33, 0.5, 0.77, 0.94, 1]) {
      const s = dayState(p);
      const { azimuthDeg: _a, ...sunRest } = s.sun;
      const { azimuthDeg: _b, ...daySunRest } = DAY_RAKE.sun;
      expect(sunRest).toEqual(daySunRest);
      expect(s.exposure).toBe(DAY_RAKE.exposure);
      expect(s.hemisphere).toEqual(DAY_RAKE.hemisphere);
      expect(s.fill).toEqual(DAY_RAKE.fill);
    }
  });
});
