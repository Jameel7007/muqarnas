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

  it('the point is a small solid dot on the origin', () => {
    const o = makeScene9Objects();
    o.point.geometry.computeBoundingSphere();
    const bs = o.point.geometry.boundingSphere!;
    expect(bs.radius).toBeLessThanOrEqual(0.14);
    expect(bs.radius).toBeGreaterThan(0.1);
    expect(Math.hypot(bs.center.x, bs.center.y)).toBeLessThan(1e-6);
    // filled: a triangulated disk, not a ring of line segments
    expect(o.point.geometry.getIndex()!.count).toBeGreaterThan(3 * 20);
  });
});
