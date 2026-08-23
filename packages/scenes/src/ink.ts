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

/** Segments ordered so drawOn draws the figure stroke by stroke. */
export function inkLines(coords: number[], opacity = 0.85): LineSegments {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(coords), 3));
  const lines = new LineSegments(
    g,
    new LineBasicMaterial({ color: INK, transparent: true, opacity }),
  );
  lines.renderOrder = 2;
  return lines;
}

/** Draw the first `t` of a stroke-ordered ink figure. */
export function drawOn(lines: LineSegments, t: number): void {
  const total = lines.geometry.getAttribute('position').count;
  lines.geometry.setDrawRange(0, 2 * Math.round((total / 2) * Math.min(Math.max(t, 0), 1)));
}

/** Fade an ink figure; keeps visibility in step so hidden ink costs nothing. */
export function inkOpacity(lines: LineSegments, opacity: number): void {
  const m = lines.material as LineBasicMaterial;
  m.opacity = opacity;
  lines.visible = opacity > 0.004;
}
