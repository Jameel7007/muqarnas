import { describe, expect, it } from 'vitest';
import { cascadeTiers } from './rig.js';
import { climbCurve } from './scene6.js';

/**
 * Scene 6's climb must open in scene 5's exact final state (tier 1 alone)
 * and end in scene 7's opening state (everything risen) — the runway cuts
 * on both sides depend on it.
 */

describe('scene 6 — the ascent', () => {
  const MAX = 17;

  it('g = 0 is exactly the scene 5 handoff: tier 1 full, all others flat', () => {
    const f = climbCurve(0, MAX);
    expect(f(1)).toBe(1);
    for (let t = 2; t <= MAX; t++) expect(f(t)).toBe(0);
  });

  it('g = 1 is exactly the scene 7 handoff: every tier risen', () => {
    const f = climbCurve(1, MAX);
    for (let t = 1; t <= MAX; t++) expect(f(t)).toBe(1);
  });

  it('rises monotonically in g for every tier, in order', () => {
    const gs = Array.from({ length: 21 }, (_, i) => i / 20);
    for (let t = 1; t <= MAX; t++) {
      let prev = -1;
      for (const g of gs) {
        const v = climbCurve(g, MAX)(t);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = v;
      }
    }
    // and a lower tier is never behind a higher one
    for (const g of gs) {
      const f = climbCurve(g, MAX);
      for (let t = 2; t <= MAX; t++) expect(f(t - 1)).toBeGreaterThanOrEqual(f(t) - 1e-12);
    }
  });

  it('never dips below the plain cascade — the base only holds tier 1 up', () => {
    for (const g of [0, 0.2, 0.5, 0.8, 1]) {
      const climb = climbCurve(g, MAX);
      const plain = cascadeTiers(g, MAX);
      for (let t = 1; t <= MAX; t++) expect(climb(t)).toBeGreaterThanOrEqual(plain(t));
    }
  });
});
