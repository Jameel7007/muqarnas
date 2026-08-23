import { Group, LineBasicMaterial, LineSegments, Vector3 } from 'three';
import { worldOutline, type Plan } from '@muqarnas/plan';
import { LIGHTING, lerpLighting, type VaultStage } from '@muqarnas/render';
import { INK, drawOn, inkLines, inkOpacity, smooth, span } from './ink.js';
import { makePlanLines } from './planLines.js';

/**
 * SCENE 4 — THE PLAN. The word is written.
 *
 * Back at the drawing board: the field's armature is ruled — frame, seams,
 * diagonals — and then the master writes ONE quarter, letter by letter,
 * from the corner in toward the crown: the same order the vault will be
 * built in, because the outermost ring of the plan is the lowest tier.
 * Symmetry does the rest — the finished quarter is carried around the
 * centre a right angle at a time, each stamp departing from the last —
 * which is not a flourish but the historical fact of the medium: the
 * Takht-i Sulaymān plate itself records only a quarter; the turning was
 * understood. Four seam diamonds stitch what no quarter can hold, and the
 * word is whole.
 *
 * The scene ends by settling into scene 5's exact opening: the assembly
 * ink (drawn letter-outline by letter-outline, so shared edges double)
 * crossfades into the deduped plan drawing, the camera into scene 5's
 * first key, the light into its reading state. The cut across the runway
 * is then invisible — the drawing simply starts to become a building.
 *
 * Everything comes from takhtPlateFull()'s own construction: the first
 * quarter of its placements IS the plate quarter, the last four ARE the
 * seam diamonds. Nothing is re-derived.
 */

export interface Scene4Objects {
  readonly group: Group;
  readonly armature: LineSegments;
  readonly quarterInk: LineSegments;
  readonly stamps: readonly { group: Group; lines: LineSegments }[];
  readonly seams: LineSegments;
  readonly settled: LineSegments;
  readonly quarterCount: number;
  /** Writing order of the quarter: centroid radii, corner first. */
  readonly orderRadii: readonly number[];
}

export interface Scene4Dom {
  readonly captionA?: HTMLElement; // the armature
  readonly captionB?: HTMLElement; // one quarter, written
  readonly captionC?: HTMLElement; // symmetry carries it
  readonly captionD?: HTMLElement; // seams; the word is whole
}

const DIM = 0.42;
const PLAN_OPACITY = 0.85; // matches makePlanLines / scene 5's opening
const Z = 0.03;

type XY = readonly [number, number];

export function makeScene4Objects(plan: Plan): Scene4Objects {
  const group = new Group();
  const quarterCount = (plan.placed.length - 4) / 4;

  // ——— the armature: frame, seams, diagonals
  const s = Math.max(
    ...plan.sector.map((v) => {
      const [x, y] = v.toNumbers();
      return Math.max(Math.abs(x), Math.abs(y));
    }),
  );
  const armCoords: number[] = [];
  const rule = (a: XY, b: XY) => armCoords.push(a[0], a[1], Z, b[0], b[1], Z);
  rule([-s, -s], [s, -s]);
  rule([s, -s], [s, s]);
  rule([s, s], [-s, s]);
  rule([-s, s], [-s, -s]);
  rule([0, -s], [0, s]); // the seams
  rule([-s, 0], [s, 0]);
  rule([-s, -s], [s, s]); // the diagonals, where the jugs will sit
  rule([-s, s], [s, -s]);
  const armature = inkLines(armCoords, DIM);
  drawOn(armature, 0);
  group.add(armature);

  // ——— one quarter, in writing order: corner first, in toward the crown
  const outlines: { vs: XY[]; r: number; a: number }[] = [];
  for (let i = 0; i < quarterCount; i++) {
    const vs = worldOutline(plan.placed[i]!).verts.map((v) => v.toNumbers() as [number, number]);
    const cx = vs.reduce((acc, v) => acc + v[0], 0) / vs.length;
    const cy = vs.reduce((acc, v) => acc + v[1], 0) / vs.length;
    outlines.push({ vs, r: Math.hypot(cx, cy), a: Math.atan2(cy, cx) });
  }
  outlines.sort((p, q) => q.r - p.r || p.a - q.a);
  const quarterCoords: number[] = [];
  for (const o of outlines) {
    for (let i = 0; i < o.vs.length; i++) {
      const a = o.vs[i]!;
      const b = o.vs[(i + 1) % o.vs.length]!;
      quarterCoords.push(a[0], a[1], Z, b[0], b[1], Z);
    }
  }
  const quarterInk = inkLines(quarterCoords, PLAN_OPACITY);
  drawOn(quarterInk, 0);
  group.add(quarterInk);

  // ——— three stamps that share the quarter's geometry and are carried
  //     around the centre a right angle at a time
  const stamps = [1, 2, 3].map(() => {
    const lines = new LineSegments(
      quarterInk.geometry,
      new LineBasicMaterial({ color: INK, transparent: true, opacity: 0 }),
    );
    lines.renderOrder = 2;
    lines.visible = false;
    const g = new Group();
    g.add(lines);
    group.add(g);
    return { group: g, lines };
  });

  // ——— the four seam diamonds, pushed last by takhtPlateFull
  const seamCoords: number[] = [];
  for (let i = plan.placed.length - 4; i < plan.placed.length; i++) {
    const vs = worldOutline(plan.placed[i]!).verts.map((v) => v.toNumbers() as [number, number]);
    for (let j = 0; j < vs.length; j++) {
      const a = vs[j]!;
      const b = vs[(j + 1) % vs.length]!;
      seamCoords.push(a[0], a[1], Z, b[0], b[1], Z);
    }
  }
  const seams = inkLines(seamCoords, PLAN_OPACITY);
  drawOn(seams, 0);
  group.add(seams);

  // ——— the settled drawing: the deduped plan, scene 5's opening ink
  const settled = makePlanLines(plan);
  inkOpacity(settled, 0);
  group.add(settled);

  return {
    group,
    armature,
    quarterInk,
    stamps,
    seams,
    settled,
    quarterCount,
    orderRadii: outlines.map((o) => o.r),
  };
}

interface CamKey {
  readonly at: number;
  readonly pos: [number, number, number];
  readonly target: [number, number, number];
}

const CAMERA_PATH: CamKey[] = [
  { at: 0.0, pos: [0, -5, 40], target: [0, 0, 0] }, // the empty field
  { at: 0.1, pos: [0, -5, 40], target: [0, 0, 0] }, // held while the armature rules
  { at: 0.18, pos: [8.6, 6.4, 9], target: [9.3, 9.3, 0] }, // down to the corner
  { at: 0.32, pos: [7.4, 4.6, 13], target: [7.6, 7.6, 0] }, // drifting in with the writing
  { at: 0.52, pos: [3.4, 0.2, 24], target: [4.2, 4.2, 0] }, // the quarter nearly whole
  // aimed low, so the turning quarter sweeps above the caption band
  { at: 0.62, pos: [0, -6, 46], target: [0, -3.2, 0] },
  { at: 0.86, pos: [0, -7, 58], target: [0, 0, 0] }, // scene 5's opening
  { at: 1.0, pos: [0, -7, 58], target: [0, 0, 0] },
];

export function createScene4(objects: Scene4Objects, stage: VaultStage, dom: Scene4Dom = {}) {
  const pos = new Vector3();
  const tgt = new Vector3();

  return (p: number): void => {
    const settle = span(p, 0.87, 0.93);

    // the armature, ruled and later lifted away
    drawOn(objects.armature, span(p, 0.03, 0.11));
    inkOpacity(objects.armature, DIM * (1 - span(p, 0.8, 0.86)));

    // the quarter, written corner to crown
    drawOn(objects.quarterInk, span(p, 0.13, 0.55));
    inkOpacity(objects.quarterInk, PLAN_OPACITY * (1 - settle));

    // carried around the centre a right angle at a time
    objects.stamps.forEach((stamp, i) => {
      const w0 = 0.56 + 0.07 * i;
      const t = span(p, w0, w0 + 0.09);
      stamp.group.rotation.z = (i + t) * (Math.PI / 2);
      const arrive = span(p, w0, w0 + 0.025);
      inkOpacity(stamp.lines, PLAN_OPACITY * arrive * (1 - settle));
    });

    // the seams stitched shut
    drawOn(objects.seams, span(p, 0.8, 0.85));
    inkOpacity(objects.seams, PLAN_OPACITY * (1 - settle));

    // and the drawing settles into scene 5's opening ink
    inkOpacity(objects.settled, PLAN_OPACITY * settle);

    // camera
    let sg = 0;
    while (sg < CAMERA_PATH.length - 2 && p > CAMERA_PATH[sg + 1]!.at) sg++;
    const a = CAMERA_PATH[sg]!;
    const b = CAMERA_PATH[sg + 1]!;
    const t = smooth((p - a.at) / (b.at - a.at));
    pos.set(...a.pos).lerp(new Vector3(...b.pos), t);
    tgt.set(...a.target).lerp(new Vector3(...b.target), t);
    stage.camera.position.copy(pos);
    stage.controls.target.copy(tgt);
    stage.controls.update();

    // drafting light easing into scene 5's reading state
    const state = lerpLighting(LIGHTING.ember, LIGHTING.court, span(p, 0.58, 0.84));
    stage.applyLighting({ ...state, exposure: state.exposure + 0.25 * span(p, 0.78, 0.92) });

    // captions
    if (dom.captionA) {
      dom.captionA.style.opacity = String(span(p, 0.03, 0.09) * (1 - span(p, 0.14, 0.2)));
    }
    if (dom.captionB) {
      dom.captionB.style.opacity = String(span(p, 0.22, 0.28) * (1 - span(p, 0.5, 0.56)));
    }
    if (dom.captionC) {
      dom.captionC.style.opacity = String(span(p, 0.58, 0.64) * (1 - span(p, 0.76, 0.82)));
    }
    if (dom.captionD) {
      dom.captionD.style.opacity = String(span(p, 0.84, 0.9) * (1 - span(p, 0.96, 1)));
    }
  };
}
