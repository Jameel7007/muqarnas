import { describe, expect, it } from 'vitest';
import { drawOn, inkLines } from './ink.js';

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
