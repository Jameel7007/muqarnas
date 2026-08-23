import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments } from 'three';
import { worldOutline, type Plan } from '@muqarnas/plan';

/**
 * The plan as a drawing: ink lines hovering just off the ground plane.
 * Scene 4 ends on this; scene 5 dissolves it as the tiles rise into lit
 * plaster — the drawing becomes the building. Unlit line material: this is
 * ink, not matter, so the lighting language does not apply to it.
 */
export function makePlanLines(plan: Plan, color = 0xe8e2d5): LineSegments {
  const seen = new Set<string>();
  const coords: number[] = [];
  for (const placed of plan.placed) {
    const { verts } = worldOutline(placed);
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i]!;
      const b = verts[(i + 1) % verts.length]!;
      const ka = a.key();
      const kb = b.key();
      const key = ka < kb ? `${ka}~${kb}` : `${kb}~${ka}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const [ax, ay] = a.toNumbers();
      const [bx, by] = b.toNumbers();
      coords.push(ax, ay, 0.03, bx, by, 0.03);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(coords), 3));
  const m = new LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const lines = new LineSegments(g, m);
  lines.renderOrder = 2;
  return lines;
}
