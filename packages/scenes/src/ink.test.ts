import { afterEach, describe, expect, it } from 'vitest';
import { drawOn, hairlineWeight, inkLines } from './ink.js';

/**
 * A GPU line is one physical pixel wide whatever the display, so the
 * drawing scenes bundle their strokes on a phone and leave them a single
 * hairline on a monitor, where a bundle reads as a doubled line.
 */
describe('hairline weight', () => {
  const globals = globalThis as { matchMedia?: unknown };
  const original = Object.prototype.hasOwnProperty.call(globals, 'matchMedia')
    ? globals.matchMedia
    : undefined;
  const stub = (matches: (query: string) => boolean) => {
    globals.matchMedia = (query: string) => ({ matches: matches(query) });
  };
  afterEach(() => {
    if (original === undefined) delete globals.matchMedia;
    else globals.matchMedia = original;
  });

  it('is bare on a mouse-and-monitor display', () => {
    stub(() => false);
    expect(hairlineWeight(0.004)).toBe(0);
  });

  it('bundles on a touch screen, in any orientation', () => {
    stub((q) => q.includes('pointer: coarse'));
    expect(hairlineWeight(0.004)).toBe(0.004);
  });

  it('bundles on a narrow viewport', () => {
    stub((q) => q.includes('max-width'));
    expect(hairlineWeight(0.004)).toBe(0.004);
  });

  it('stays bare where no media query exists at all', () => {
    delete globals.matchMedia;
    expect(hairlineWeight(0.004)).toBe(0);
  });
});

describe('drawn ink', () => {
  it('keeps the original one-segment representation by default', () => {
    const lines = inkLines([0, 0, 0, 1, 0, 0]);
    expect(lines.geometry.getAttribute('position').count).toBe(2);
    expect(lines.userData.inkStrokeCopies).toBe(1);
    expect(lines.userData.inkSourceSegments).toBe(1);
  });

  it('subdivides long strokes and reveals complete weighted bundles', () => {
    const lines = inkLines(
      [0, 0, 0, 1, 0, 0],
      0.85,
      { plane: 'xy', weight: 0.1, maxSegmentLength: 0.25 },
    );
    const pos = lines.geometry.getAttribute('position');
    expect(lines.userData.inkStrokeCopies).toBe(3);
    expect(lines.userData.inkSourceSegments).toBe(4);
    expect(pos.count).toBe(4 * 3 * 2);

    drawOn(lines, 0.5);
    expect(lines.geometry.drawRange.count).toBe(2 * 3 * 2);
  });

  it('offsets ink within the requested drawing plane', () => {
    const xy = inkLines([0, 0, 0.03, 1, 0, 0.03], 0.85, { plane: 'xy', weight: 0.1 });
    const xyp = xy.geometry.getAttribute('position');
    expect(xyp.getX(0)).toBe(0);
    expect(xyp.getY(0)).toBeCloseTo(-0.1, 6);
    expect(xyp.getZ(0)).toBeCloseTo(0.03, 6);

    const xz = inkLines([0, 0, 0, 1, 0, 0], 0.85, { plane: 'xz', weight: 0.1 });
    const xzp = xz.geometry.getAttribute('position');
    expect(xzp.getX(0)).toBe(0);
    expect(xzp.getY(0)).toBe(0);
    expect(xzp.getZ(0)).toBeCloseTo(-0.1, 6);
  });
});
