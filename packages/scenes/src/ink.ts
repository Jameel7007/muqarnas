import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments } from 'three';

/**
 * The ink language shared by the drawing scenes: unlit line-segment figures
 * whose stroke order is meaningful, revealed through setDrawRange so a
 * figure draws itself on under the scrub. Ink is not matter — the lighting
 * language does not apply to it.
 */

export const INK = 0xe8e2d5;

export const smooth = (t: number): number => {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
};
export const span = (p: number, a: number, b: number): number => smooth((p - a) / (b - a));

/**
 * A line primitive is one PHYSICAL pixel wide however dense the display,
 * so a hairline that reads cleanly on a desktop monitor nearly vanishes
 * on a phone. The drawing scenes bundle their strokes into three parallel
 * lines there — and only there: on a pointer display the same bundle
 * reads as a doubled, smeared stroke rather than a heavier one, so a
 * mouse-and-monitor viewer keeps the original single hairline.
 */
export function hairlineWeight(weight: number): number {
  if (typeof matchMedia === 'undefined') return 0;
  const touch = matchMedia('(pointer: coarse)').matches;
  const narrow = matchMedia('(max-width: 640px)').matches;
  return touch || narrow ? weight : 0;
}

export interface InkLineOptions {
  /** Plane in which the drawing lies; used to offset the parallel ink strokes. */
  readonly plane?: 'xy' | 'xz';
  /** Half-width of a three-stroke ink bundle, in drawing-space units. */
  readonly weight?: number;
  /** Subdivide long strokes so drawOn advances continuously instead of edge by edge. */
  readonly maxSegmentLength?: number;
}

function drawnCoords(coords: number[], options: InkLineOptions): {
  coords: number[];
  copies: number;
  segments: number;
} {
  const weight = Math.max(0, options.weight ?? 0);
  const offsets = weight > 0 ? [-weight, 0, weight] : [0];
  const maxLength = options.maxSegmentLength && options.maxSegmentLength > 0
    ? options.maxSegmentLength
    : Infinity;
  const plane = options.plane ?? 'xy';
  const drawn: number[] = [];
  let segments = 0;

  for (let i = 0; i + 5 < coords.length; i += 6) {
    const ax = coords[i]!;
    const ay = coords[i + 1]!;
    const az = coords[i + 2]!;
    const bx = coords[i + 3]!;
    const by = coords[i + 4]!;
    const bz = coords[i + 5]!;
    const du = bx - ax;
    const dv = plane === 'xy' ? by - ay : bz - az;
    const length = Math.hypot(du, dv);
    const steps = Math.max(1, Math.ceil(length / maxLength));
    const pu = length > 0 ? -dv / length : 0;
    const pv = length > 0 ? du / length : 0;

    for (let step = 0; step < steps; step++) {
      const t0 = step / steps;
      const t1 = (step + 1) / steps;
      const x0 = ax + (bx - ax) * t0;
      const y0 = ay + (by - ay) * t0;
      const z0 = az + (bz - az) * t0;
      const x1 = ax + (bx - ax) * t1;
      const y1 = ay + (by - ay) * t1;
      const z1 = az + (bz - az) * t1;

      for (const offset of offsets) {
        if (plane === 'xy') {
          drawn.push(
            x0 + pu * offset, y0 + pv * offset, z0,
            x1 + pu * offset, y1 + pv * offset, z1,
          );
        } else {
          drawn.push(
            x0 + pu * offset, y0, z0 + pv * offset,
            x1 + pu * offset, y1, z1 + pv * offset,
          );
        }
      }
      segments++;
    }
  }

  return { coords: drawn, copies: offsets.length, segments };
}

/** Segments ordered so drawOn draws the figure stroke by stroke. */
export function inkLines(
  coords: number[],
  opacity = 0.85,
  options: InkLineOptions = {},
): LineSegments {
  const ink = drawnCoords(coords, options);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(ink.coords), 3));
  const lines = new LineSegments(
    g,
    new LineBasicMaterial({ color: INK, transparent: true, opacity }),
  );
  lines.userData.inkStrokeCopies = ink.copies;
  lines.userData.inkSourceSegments = ink.segments;
  lines.renderOrder = 2;
  return lines;
}

/** Draw the first `t` of a stroke-ordered ink figure. */
export function drawOn(lines: LineSegments, t: number): void {
  const total = lines.geometry.getAttribute('position').count;
  const copies = Math.max(1, Number(lines.userData.inkStrokeCopies ?? 1));
  const segments = total / (2 * copies);
  const visible = Math.round(segments * Math.min(Math.max(t, 0), 1));
  lines.geometry.setDrawRange(0, 2 * copies * visible);
}

/** Fade an ink figure; keeps visibility in step so hidden ink costs nothing. */
export function inkOpacity(lines: LineSegments, opacity: number): void {
  const m = lines.material as LineBasicMaterial;
  m.opacity = opacity;
  lines.visible = opacity > 0.004;
}
