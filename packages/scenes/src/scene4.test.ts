import { describe, expect, it } from 'vitest';
import { takhtPlateFull, worldOutline } from '@muqarnas/plan';
import { makePlanLines } from './planLines.js';
import { makeScene4Objects } from './scene4.js';

/**
 * Scene 4 leans on takhtPlateFull()'s construction — quarter × four
 * right-angle turns, seam diamonds last — and must settle into exactly the
 * ink scene 5 opens with. Pin all of it.
 */

describe('scene 4 — the plan', () => {
  const plan = takhtPlateFull();
  const objects = makeScene4Objects(plan);

  it('the plate is one quarter, turned: stamp k is the quarter rotated k·90°', () => {
    const n = objects.quarterCount;
    expect(n).toBe(157);
    expect(plan.placed.length).toBe(4 * n + 4);
    for (const i of [0, 41, 96, n - 1]) {
      const base = worldOutline(plan.placed[i]!).verts.map((v) => v.toNumbers());
      for (const k of [1, 2, 3]) {
        const copy = worldOutline(plan.placed[i + k * n]!).verts.map((v) => v.toNumbers());
        const c = Math.cos((k * Math.PI) / 2);
        const s = Math.sin((k * Math.PI) / 2);
        base.forEach(([x, y], j) => {
          expect(copy[j]![0]).toBeCloseTo(c * x! - s * y!, 9);
          expect(copy[j]![1]).toBeCloseTo(s * x! + c * y!, 9);
        });
      }
    }
  });

  it('the four seam diamonds sit last, centred on the axes at 4 + √2/2', () => {
    for (let i = plan.placed.length - 4; i < plan.placed.length; i++) {
      const vs = worldOutline(plan.placed[i]!).verts.map((v) => v.toNumbers());
      expect(plan.placed[i]!.def.kind).toBe('square');
      const cx = vs.reduce((a, v) => a + v[0]!, 0) / vs.length;
      const cy = vs.reduce((a, v) => a + v[1]!, 0) / vs.length;
      // a 45°-rotated unit square with its low corner on a seam at radius 4
      expect(Math.min(Math.abs(cx), Math.abs(cy))).toBeCloseTo(0, 9);
      expect(Math.max(Math.abs(cx), Math.abs(cy))).toBeCloseTo(4 + Math.SQRT1_2, 9);
    }
  });

  it('writes the quarter corner-first: radii never increase', () => {
    for (let i = 1; i < objects.orderRadii.length; i++) {
      expect(objects.orderRadii[i]!).toBeLessThanOrEqual(objects.orderRadii[i - 1]! + 1e-9);
    }
  });

  it('settles into exactly the deduped drawing scene 5 opens with', () => {
    const reference = makePlanLines(plan);
    const a = objects.settled.geometry.getAttribute('position');
    const b = reference.geometry.getAttribute('position');
    expect(a.count).toBe(b.count);
    // and the per-outline assembly ink is heavier than the deduped drawing —
    // the very redundancy the settle crossfade removes
    const quarterSegs = objects.quarterInk.geometry.getAttribute('position').count;
    expect(4 * quarterSegs + objects.seams.geometry.getAttribute('position').count).toBeGreaterThan(
      b.count,
    );
  });
});
