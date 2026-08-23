import { describe, expect, it } from 'vitest';
import { makeScene9Objects, returnDescent } from './scene9.js';

/**
 * The return runs the generative chain backwards; its pieces must close
 * cleanly at both ends.
 */

describe('scene 9 — the return', () => {
  it('opens with the vault whole and has dissolved it by two thirds', () => {
    expect(returnDescent(0)).toBe(1);
    expect(returnDescent(0.18)).toBe(1);
    expect(returnDescent(0.62)).toBe(0);
    expect(returnDescent(1)).toBe(0);
  });

  it('only ever descends', () => {
    let prev = Infinity;
    for (let i = 0; i <= 100; i++) {
      const g = returnDescent(i / 100);
      expect(g).toBeLessThanOrEqual(prev + 1e-12);
      prev = g;
    }
  });

  it('the surviving stroke is one module of ink, centred on the point', () => {
    const o = makeScene9Objects();
    const pos = o.stroke.geometry.getAttribute('position');
    expect(pos.count).toBe(2);
    const dx = pos.getX(1) - pos.getX(0);
    const dy = pos.getY(1) - pos.getY(0);
    expect(Math.hypot(dx, dy)).toBeCloseTo(1, 12);
    expect((pos.getX(0) + pos.getX(1)) / 2).toBeCloseTo(0, 12);
    expect((pos.getY(0) + pos.getY(1)) / 2).toBeCloseTo(0, 12);
  });

  it('the point is a closed mark on the origin', () => {
    const o = makeScene9Objects();
    const pos = o.point.geometry.getAttribute('position');
    expect(pos.count).toBeGreaterThanOrEqual(2 * 8);
    for (let i = 0; i < pos.count; i++) {
      expect(Math.hypot(pos.getX(i), pos.getY(i))).toBeCloseTo(0.16, 6);
    }
    expect(pos.getX(pos.count - 1)).toBeCloseTo(pos.getX(0), 9);
    expect(pos.getY(pos.count - 1)).toBeCloseTo(pos.getY(0), 9);
  });
});
