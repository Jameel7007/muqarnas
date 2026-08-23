import { describe, expect, it } from 'vitest';
import { halfRhombus, halfSquare, rhombus, square, takhtPlateFull, worldOutline } from '@muqarnas/plan';
import { makeScene3Objects } from './scene3.js';

type XY = readonly [number, number];
const numVerts = (d: { verts: readonly { toNumbers(): number[] }[] }): XY[] =>
  d.verts.map((v) => v.toNumbers() as [number, number]);
const centroid = (vs: XY[]): XY => [
  vs.reduce((s, v) => s + v[0], 0) / vs.length,
  vs.reduce((s, v) => s + v[1], 0) / vs.length,
];

/**
 * Scene 3 shows the alphabet the library constructs — so the scene's
 * display data must agree with the constructors and the plate exactly.
 */

describe('scene 3 — the alphabet', () => {
  const plan = takhtPlateFull();
  const objects = makeScene3Objects(plan);

  it('stages the eight letters, their twins, cuts, and marks', () => {
    // 2 seeds + 4 bisection pieces (two twins) + 4 complements = 10 shapes,
    // plus 5 construction strokes riding the seeds
    expect(objects.pieces.length).toBe(15);
    const marked = objects.pieces.filter((p) => p.marks);
    expect(marked.length).toBe(6); // every letter but the two seeds
  });

  it('inks a fourteen-element patch of the real plate corner', () => {
    expect(objects.fragmentCount).toBe(14);
    const pos = objects.fragment.geometry.getAttribute('position');
    expect(pos.count).toBeGreaterThan(2 * 3 * 14); // ≥3 edges per element
  });

  it('the patch holds the corner cells and is one connected piece', () => {
    const outlines = plan.placed.map((p) => numVerts(worldOutline(p)));
    const max = Math.max(...outlines.flat().map((v) => Math.max(Math.abs(v[0]), Math.abs(v[1]))));
    const entries = outlines.map((vs, i) => {
      const c = centroid(vs);
      return { i, vs, d: Math.hypot(c[0] - max, c[1] - max) };
    });
    entries.sort((a, b) => a.d - b.d);
    const chosen = entries.slice(0, 14);
    // the cells that touch the exact corner — where every reading begins —
    // must be in the picture
    const touching = entries.filter((e) =>
      e.vs.some((v) => Math.abs(v[0] - max) < 1e-9 && Math.abs(v[1] - max) < 1e-9),
    );
    expect(touching.length).toBeGreaterThan(0);
    for (const t of touching) expect(chosen.some((c) => c.i === t.i)).toBe(true);
    // and the patch may not scatter: one vertex-connected component
    const key = (v: XY) => `${v[0].toFixed(6)},${v[1].toFixed(6)}`;
    const seen = new Set([chosen[0]!.i]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const a of chosen) {
        if (seen.has(a.i)) continue;
        const aset = new Set(a.vs.map(key));
        if (chosen.some((b) => seen.has(b.i) && b.vs.some((v) => aset.has(key(v))))) {
          seen.add(a.i);
          grew = true;
        }
      }
    }
    expect(seen.size).toBe(chosen.length);
  });

  it('the explode directions are perpendicular to their cuts, twins exact', () => {
    const sqVs = numVerts(square());
    const rhVs = numVerts(rhombus());
    // dSq ⊥ the square's diagonal, dRh ⊥ the rhombus's short diagonal
    const dSq = [Math.SQRT1_2, -Math.SQRT1_2] as const;
    const diag: XY = [sqVs[2]![0] - sqVs[0]![0], sqVs[2]![1] - sqVs[0]![1]];
    expect(Math.abs(dSq[0] * diag[0] + dSq[1] * diag[1])).toBeLessThan(1e-12);
    const dRh = [-0.9239, -0.3827] as const;
    const short: XY = [rhVs[3]![0] - rhVs[1]![0], rhVs[3]![1] - rhVs[1]![1]];
    expect(Math.abs(dRh[0] * short[0] + dRh[1] * short[1])).toBeLessThan(1e-4);
    // point reflection through the parent centre reproduces the other half
    const key = (v: XY) => `${v[0].toFixed(9)},${v[1].toFixed(9)}`;
    const sqC = centroid(sqVs);
    const twin = numVerts(halfSquare()).map((v) => [2 * sqC[0] - v[0], 2 * sqC[1] - v[1]] as XY);
    expect(new Set(twin.map(key))).toEqual(new Set([sqVs[0]!, sqVs[2]!, sqVs[3]!].map(key)));
    const rhC = centroid(rhVs);
    const twinR = numVerts(halfRhombus()).map((v) => [2 * rhC[0] - v[0], 2 * rhC[1] - v[1]] as XY);
    expect(new Set(twinR.map(key))).toEqual(new Set([rhVs[1]!, rhVs[2]!, rhVs[3]!].map(key)));
  });

  it('keeps every outline a closed loop', () => {
    for (const piece of objects.pieces.filter((p) => p.move)) {
      const pos = piece.outline.geometry.getAttribute('position');
      // consecutive strokes chain, and the last returns to the first
      expect([pos.getX(0), pos.getY(0)]).toEqual([
        pos.getX(pos.count - 1),
        pos.getY(pos.count - 1),
      ]);
    }
  });

  it('census: the plate is written in the alphabet alone', () => {
    const kinds = new Set(plan.placed.map((p) => p.def.kind));
    for (const k of kinds) {
      expect([
        'square',
        'half-square',
        'rhombus',
        'half-rhombus',
        'jug',
        'large-biped',
        'almond',
        'small-biped',
      ]).toContain(k);
    }
    expect(plan.placed.length).toBeGreaterThan(150);
  });
});
