import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three';
import { LIGHTING, lerpLighting, withAoAttribute, type VaultStage } from '@muqarnas/render';

/**
 * SCENE 1 — THE SQUARE AND THE CIRCLE. The argument.
 *
 * Before any ornament: a square draws itself in ink, a circle draws itself
 * inside it, and the four corners left between them hatch themselves as the
 * problem. Then the drawing lifts — the site's grammar, spoken from the
 * first line: walls rise from the square, a dome descends to the circle,
 * and they do not meet. The rim touches the walls only at their midpoints;
 * over each corner hangs a void that nothing spans. The camera enters the
 * room through that void, and the raking key follows it in.
 *
 * The room is the vault's own field: half-side = PLATE_FIELD_SPAN, so the
 * square drawn here is the square the plate fills five scenes later.
 */

export interface Scene1Objects {
  readonly group: Group;
  readonly inkSquare: LineSegments;
  readonly inkCircle: LineSegments;
  readonly inkCorners: LineSegments;
  readonly walls: Group;
  readonly dome: Mesh;
  readonly wallHeight: number;
}

export interface Scene1Dom {
  readonly captionA?: HTMLElement; // a square room, a round dome
  readonly captionB?: HTMLElement; // they do not meet
  readonly captionC?: HTMLElement; // the zone of transition
}

const INK = 0xe8e2d5;
const CIRCLE_SEGMENTS = 96;
const HATCHES_PER_CORNER = 5;

const smooth = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
};
const span = (p: number, a: number, b: number) => smooth((p - a) / (b - a));

/** Segments ordered so setDrawRange draws the figure on, stroke by stroke. */
function inkLines(coords: number[], opacity = 0.85): LineSegments {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(coords), 3));
  const lines = new LineSegments(
    g,
    new LineBasicMaterial({ color: INK, transparent: true, opacity }),
  );
  lines.renderOrder = 2;
  return lines;
}

function squareCoords(h: number, z: number): number[] {
  const c: [number, number][] = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  const coords: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = c[i]!;
    const [bx, by] = c[(i + 1) % 4]!;
    coords.push(ax, ay, z, bx, by, z);
  }
  return coords;
}

function circleCoords(r: number, z: number): number[] {
  const coords: number[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / CIRCLE_SEGMENTS;
    const b = -Math.PI / 2 + (2 * Math.PI * (i + 1)) / CIRCLE_SEGMENTS;
    coords.push(r * Math.cos(a), r * Math.sin(a), z, r * Math.cos(b), r * Math.sin(b), z);
  }
  return coords;
}

/**
 * The leftover corners, hatched with 45° strokes. For the (+,+) corner a
 * stroke at diagonal offset a runs (2a−h, h) → (h, 2a−h): its endpoints sit
 * on the two walls and the whole stroke stays outside the circle, since
 * |(a−s, a+s)|² = 2a² + 2s² ≥ r² whenever a√2 ≥ r. The family sweeps a from
 * the circle out to the corner — the chamfer the squinch will make real.
 */
function cornerHatchCoords(h: number, r: number, z: number): number[] {
  const coords: number[] = [];
  const inner = r / Math.SQRT2;
  for (const [sx, sy] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ] as const) {
    for (let j = 0; j < HATCHES_PER_CORNER; j++) {
      const a = inner + ((h - inner) * (j + 0.5)) / HATCHES_PER_CORNER;
      coords.push(sx * (2 * a - h), sy * h, z, sx * h, sy * (2 * a - h), z);
    }
  }
  return coords;
}

/** Draw the first `t` of a stroke-ordered ink figure. */
function drawOn(lines: LineSegments, t: number): void {
  const total = lines.geometry.getAttribute('position').count;
  lines.geometry.setDrawRange(0, 2 * Math.round((total / 2) * Math.min(Math.max(t, 0), 1)));
}

export function makeScene1Objects(
  material: Material,
  opts: { half: number; wallHeight?: number },
): Scene1Objects {
  const h = opts.half;
  const wallHeight = opts.wallHeight ?? 9;
  const w = 0.7; // wall thickness

  const group = new Group();
  const inkSquare = inkLines(squareCoords(h, 0.03));
  const inkCircle = inkLines(circleCoords(h, 0.03));
  const inkCorners = inkLines(cornerHatchCoords(h, h, 0.03), 0.55);
  group.add(inkSquare, inkCircle, inkCorners);

  // the room: butt-jointed slabs on the drawn square, plus a floor to catch
  // the light; scale.z raises them out of the drawing
  const walls = new Group();
  const slab = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const m = new Mesh(withAoAttribute(new BoxGeometry(sx, sy, sz)), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    walls.add(m);
  };
  slab(2 * h + 2 * w, w, wallHeight, 0, h + w / 2, wallHeight / 2);
  slab(2 * h + 2 * w, w, wallHeight, 0, -h - w / 2, wallHeight / 2);
  slab(w, 2 * h, wallHeight, h + w / 2, 0, wallHeight / 2);
  slab(w, 2 * h, wallHeight, -h - w / 2, 0, wallHeight / 2);
  slab(2 * h + 2 * w, 2 * h + 2 * w, 0.5, 0, 0, -0.25);
  walls.visible = false;
  group.add(walls);

  // the dome: a hemisphere whose rim is the drawn circle, lifted to the
  // wall head — it grazes the four inner faces at their midpoints and
  // nothing more
  const dome = new Mesh(
    withAoAttribute(new SphereGeometry(h, 64, 32, 0, 2 * Math.PI, 0, Math.PI / 2)),
    material,
  );
  dome.rotation.x = Math.PI / 2;
  dome.castShadow = true;
  dome.receiveShadow = true;
  dome.visible = false;
  group.add(dome);

  return { group, inkSquare, inkCircle, inkCorners, walls, dome, wallHeight };
}

interface CamKey {
  readonly at: number;
  readonly pos: [number, number, number];
  readonly target: [number, number, number];
}

const CAMERA_PATH: CamKey[] = [
  { at: 0.0, pos: [0, -6, 52], target: [0, 0, 0] }, // the drawing, from above
  { at: 0.3, pos: [0, -6, 52], target: [0, 0, 0] }, // held still while it draws
  { at: 0.52, pos: [16, -30, 30], target: [0, 0, 4] }, // tilting as the walls rise
  { at: 0.68, pos: [26, -24, 26], target: [0, 0, 8] }, // the dome arrives
  { at: 0.84, pos: [22, 22, 20], target: [3, 3, 6] }, // over the corner void
  { at: 1.0, pos: [29, 21, 5.5], target: [3, 3, 10] }, // at eye level: the notch against the night
];

/** The key swung across the corner the camera ends on, so its edge splits light. */
const RAKE_CORNER = { ...LIGHTING.rake, sun: { ...LIGHTING.rake.sun, azimuthDeg: 70 } };

export function createScene1(objects: Scene1Objects, stage: VaultStage, dom: Scene1Dom = {}) {
  const pos = new Vector3();
  const tgt = new Vector3();

  return (p: number): void => {
    // the drawing draws itself: square, circle, then the leftover corners
    drawOn(objects.inkSquare, span(p, 0.02, 0.1));
    drawOn(objects.inkCircle, span(p, 0.1, 0.2));
    drawOn(objects.inkCorners, span(p, 0.22, 0.32));

    // the lift: walls out of the square…
    objects.walls.visible = p > 0.3;
    objects.walls.scale.z = Math.max(span(p, 0.32, 0.5), 0.003);

    // …and the dome down to the circle
    objects.dome.visible = p > 0.48;
    objects.dome.position.z = objects.wallHeight + 34 * (1 - span(p, 0.5, 0.7));

    // ink yields to matter; the hatched corners linger longest
    const sq = objects.inkSquare.material as LineBasicMaterial;
    sq.opacity = 0.85 * (1 - span(p, 0.36, 0.46));
    const ci = objects.inkCircle.material as LineBasicMaterial;
    ci.opacity = 0.85 * (1 - span(p, 0.55, 0.65));
    const co = objects.inkCorners.material as LineBasicMaterial;
    co.opacity = 0.55 * (1 - span(p, 0.6, 0.72));

    // camera
    let seg = 0;
    while (seg < CAMERA_PATH.length - 2 && p > CAMERA_PATH[seg + 1]!.at) seg++;
    const a = CAMERA_PATH[seg]!;
    const b = CAMERA_PATH[seg + 1]!;
    const t = smooth((p - a.at) / (b.at - a.at));
    pos.set(...a.pos).lerp(new Vector3(...b.pos), t);
    tgt.set(...a.target).lerp(new Vector3(...b.target), t);
    stage.camera.position.copy(pos);
    stage.controls.target.copy(tgt);
    stage.controls.update();

    // light: nothing to light, then the reading light, then the key rakes
    // in through the corner the camera uses
    const toCourt = span(p, 0.3, 0.48);
    const toRake = span(p, 0.7, 0.88);
    stage.applyLighting(
      toRake > 0
        ? lerpLighting(LIGHTING.court, RAKE_CORNER, toRake)
        : lerpLighting(LIGHTING.ember, LIGHTING.court, toCourt),
    );

    // captions
    if (dom.captionA) {
      dom.captionA.style.opacity = String(span(p, 0.04, 0.1) * (1 - span(p, 0.16, 0.22)));
    }
    if (dom.captionB) {
      dom.captionB.style.opacity = String(span(p, 0.24, 0.3) * (1 - span(p, 0.4, 0.48)));
    }
    if (dom.captionC) {
      dom.captionC.style.opacity = String(span(p, 0.86, 0.94));
    }
  };
}
