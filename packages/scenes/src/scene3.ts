import { Group, Vector3, type LineSegments } from 'three';
import {
  almond,
  halfRhombus,
  halfSquare,
  jug,
  largeBiped,
  rhombus,
  smallBiped,
  square,
  worldOutline,
  type ElementDef,
  type Plan,
} from '@muqarnas/plan';
import { LIGHTING, type VaultStage } from '@muqarnas/render';
import {
  fitCameraToObject,
  sampleCameraPath,
  type CameraKey,
} from './camera.js';
import { drawOn, hairlineWeight, inkLines, inkOpacity, smooth, span } from './ink.js';

/**
 * SCENE 3 — THE ALPHABET. The letters.
 *
 * Two seeds draw themselves: the square, and the rhombus of its half-turn.
 * Then each seed demonstrates its children, in the derivations the library
 * itself records: a diagonal bisects the square into half-squares; the
 * short diagonal bisects the rhombus; a quarter octagon cut from the
 * square's corner is the jug, and what remains is the large biped; the
 * perpendiculars inside the rhombus find the almond, and what remains is
 * the small biped. Divisions and complements — nothing is invented.
 *
 * The eight letters then file into a specimen row and take their marks:
 * a dot on the central node (the corner that becomes the cell's apex) and
 * ticks on the two curved sides where al-Kāshī's profile rises. The seeds
 * take no marks — their orientation is decided only at placement.
 *
 * Last, letters into words: a corner patch of the real Takht-i Sulaymān
 * plate inks itself element by element — the same corner every valid
 * reading starts from — while the caption counts the full census of the
 * digitized plate. Nothing here is drawn by hand: every outline comes from
 * the element constructors, every patch stroke from the plate data.
 */

export interface Scene3Objects {
  readonly group: Group;
  readonly fragment: LineSegments;
  /** Number of elements inked in the corner patch. */
  readonly fragmentCount: number;
}

export interface Scene3Dom {
  readonly captionA?: HTMLElement; // the seeds
  readonly captionB?: HTMLElement; // divisions and complements
  readonly captionC?: HTMLElement; // the row and its marks
  readonly captionD?: HTMLElement; // the census
}

const BRIGHT = 0.9;
const DIM = 0.42;
const MARK = 0.75;
const Z = 0.03;
// the stroke bundle is resolved per device at construction; on a monitor
// it is a single hairline, as drawn
const DRAWING_INK = { plane: 'xy', maxSegmentLength: 0.04 } as const;
const HAIRLINE = 0.004;

type XY = readonly [number, number];

interface Way {
  readonly at: number;
  readonly c: XY;
  readonly o: number;
}

interface Piece {
  readonly group: Group;
  readonly outline: LineSegments;
  readonly base: number;
  readonly center: XY;
  readonly way: Way[];
  /** Reveal window for drawOn; pieces that appear by fade use [0, 0]. */
  readonly draw: readonly [number, number];
  /** Construction strokes ride in their parent's group and must not steer it. */
  readonly move: boolean;
  readonly marks?: LineSegments;
}

const vertsOf = (d: ElementDef): XY[] => d.verts.map((v) => v.toNumbers() as [number, number]);
const avg = (vs: XY[]): XY => [
  vs.reduce((s, v) => s + v[0], 0) / vs.length,
  vs.reduce((s, v) => s + v[1], 0) / vs.length,
];
const reflectThrough = (c: XY, vs: XY[]): XY[] => vs.map((v) => [2 * c[0] - v[0], 2 * c[1] - v[1]]);

function loopCoords(vs: XY[]): number[] {
  const coords: number[] = [];
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i]!;
    const b = vs[(i + 1) % vs.length]!;
    coords.push(a[0], a[1], Z, b[0], b[1], Z);
  }
  return coords;
}

function strokeCoords(pts: XY[]): number[] {
  const coords: number[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    coords.push(pts[i]![0], pts[i]![1], Z, pts[i + 1]![0], pts[i + 1]![1], Z);
  }
  return coords;
}

/** Apex dot and curved-side ticks, in the element's own coordinates. */
function markCoords(d: ElementDef): number[] {
  const vs = vertsOf(d);
  const coords: number[] = [];
  if (d.centralNode !== null) {
    const c = vs[d.centralNode]!;
    const n = 10;
    const r = 0.055;
    for (let i = 0; i < n; i++) {
      const a0 = (2 * Math.PI * i) / n;
      const a1 = (2 * Math.PI * (i + 1)) / n;
      coords.push(
        c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0), Z,
        c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1), Z,
      );
    }
  }
  for (const e of d.curvedSides ?? []) {
    const a = vs[e]!;
    const b = vs[(e + 1) % vs.length]!;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const px = -(b[1] - a[1]) / len;
    const py = (b[0] - a[0]) / len;
    coords.push(mx - px * 0.05, my - py * 0.05, Z, mx + px * 0.05, my + py * 0.05, Z);
  }
  return coords;
}

/** The plate's corner patch: the nearest elements to one outer corner. */
function cornerPatch(plan: Plan, count: number): { coords: number[]; n: number } {
  const outlines = plan.placed.map((placed) =>
    worldOutline(placed).verts.map((v) => v.toNumbers() as [number, number]),
  );
  const max = Math.max(...outlines.flat().map((v) => Math.max(Math.abs(v[0]), Math.abs(v[1]))));
  // anchored on the corner itself, so the tip cells are always in the patch
  const target: XY = [max, max];
  const entries = outlines.map((vs) => {
    const c = avg(vs);
    return { vs, d: Math.hypot(c[0] - target[0], c[1] - target[1]) };
  });
  entries.sort((a, b) => a.d - b.d);
  const chosen = entries.slice(0, count);
  const coords: number[] = [];
  for (const e of chosen) {
    for (let i = 0; i < e.vs.length; i++) {
      const a = e.vs[i]!;
      const b = e.vs[(i + 1) % e.vs.length]!;
      coords.push(a[0], a[1], Z, b[0], b[1], Z);
    }
  }
  return { coords, n: chosen.length };
}

/** Seed centres on stage, and the specimen row. */
const SQ_SEED: XY = [-2.1, 0.9];
const RH_SEED: XY = [2.1, 0.9];
const ROW_Y = -2.7;
const rowSlot = (i: number): XY => [-5.53 + 1.58 * i, ROW_Y];

export function makeScene3Objects(plan: Plan): Scene3Objects & { pieces: Piece[] } {
  const group = new Group();
  const pieces: Piece[] = [];
  const inkOptions = { ...DRAWING_INK, weight: hairlineWeight(HAIRLINE) };

  const sq = square();
  const rh = rhombus();
  const hs = halfSquare();
  const hr = halfRhombus();
  const jg = jug();
  const lb = largeBiped();
  const al = almond();
  const sb = smallBiped();

  const sqVs = vertsOf(sq);
  const rhVs = vertsOf(rh);
  const sqC = avg(sqVs);
  const rhC = avg(rhVs);
  // world position of a child's own centre while it still sits inside its
  // parent's seed frame
  const inSquare = (c: XY): XY => [SQ_SEED[0] - sqC[0] + c[0], SQ_SEED[1] - sqC[1] + c[1]];
  const inRhombus = (c: XY): XY => [RH_SEED[0] - rhC[0] + c[0], RH_SEED[1] - rhC[1] + c[1]];
  const off = (c: XY, d: XY, s: number): XY => [c[0] + d[0] * s, c[1] + d[1] * s];

  const piece = (
    verts: XY[],
    base: number,
    way: Way[],
    draw: readonly [number, number],
    markDef?: ElementDef,
  ): Piece => {
    const g = new Group();
    const outline = inkLines(loopCoords(verts), base, inkOptions);
    g.add(outline);
    let marks: LineSegments | undefined;
    if (markDef) {
      marks = inkLines(markCoords(markDef), MARK, inkOptions);
      drawOn(marks, 0);
      g.add(marks);
    }
    group.add(g);
    const p: Piece = { group: g, outline, base, center: avg(verts), way, draw, move: true, marks };
    pieces.push(p);
    return p;
  };

  const stroke = (pts: XY[], way: Way[], draw: readonly [number, number], parent: Piece): void => {
    const ink = inkLines(strokeCoords(pts), DIM, inkOptions);
    parent.group.add(ink);
    pieces.push({
      group: parent.group,
      outline: ink,
      base: DIM,
      center: parent.center,
      way,
      draw,
      move: false,
    });
  };

  // ——— the seeds, twice interrupted, finally filed as letters
  const seedWay = (seed: XY, slot: XY): Way[] => [
    { at: 0, c: seed, o: 1 },
    { at: 0.185, c: seed, o: 1 },
    { at: 0.225, c: seed, o: 0 }, // yields to its halves
    { at: 0.28, c: seed, o: 0 },
    { at: 0.325, c: seed, o: 1 }, // restored
    { at: 0.415, c: seed, o: 0 }, // yields to its complements
    { at: 0.46, c: seed, o: 0 },
    { at: 0.5, c: seed, o: 1 }, // restored again
    { at: 0.58, c: slot, o: 1 }, // files into the row
    { at: 1, c: slot, o: 1 },
  ];
  const pSquare = piece(sqVs, BRIGHT, seedWay(SQ_SEED, rowSlot(0)), [0.03, 0.09]);
  const pRhombus = piece(rhVs, BRIGHT, seedWay(RH_SEED, rowSlot(2)), [0.03, 0.09]);

  // ——— construction strokes, drawn dim and spent in the crossfade
  const cutFade = (a: number, b: number): Way[] => [
    { at: 0, c: [0, 0], o: 1 },
    { at: a, c: [0, 0], o: 1 },
    { at: b, c: [0, 0], o: 0 },
    { at: 1, c: [0, 0], o: 0 },
  ];
  stroke([sqVs[0]!, sqVs[2]!], cutFade(0.185, 0.225), [0.14, 0.18], pSquare);
  stroke([rhVs[1]!, rhVs[3]!], cutFade(0.185, 0.225), [0.14, 0.18], pRhombus);
  stroke([sqVs[1]!, vertsOf(jg)[2]!, sqVs[3]!], cutFade(0.415, 0.46), [0.34, 0.38], pSquare);
  const alC = vertsOf(al)[2]!;
  stroke([rhVs[1]!, alC], cutFade(0.415, 0.46), [0.34, 0.365], pRhombus);
  stroke([rhVs[3]!, alC], cutFade(0.415, 0.46), [0.365, 0.38], pRhombus);

  // ——— the bisections: each pair explodes apart; one of each is enough
  const bisect = (
    verts: XY[],
    home: XY,
    burst: XY,
    slotOrExit: XY | null,
    markDef?: ElementDef,
  ): void => {
    const stay = slotOrExit !== null;
    const rest = slotOrExit ?? off(burst, [burst[0] - home[0], burst[1] - home[1]], 1.6);
    const way: Way[] = [
      { at: 0, c: home, o: 0 },
      { at: 0.185, c: home, o: 0 },
      { at: 0.225, c: burst, o: 1 }, // apart
      { at: 0.28, c: burst, o: 1 },
      // one of each is enough: the twin drifts on and evaporates
      { at: stay ? 0.38 : 0.36, c: rest, o: stay ? 1 : 0 },
      { at: 1, c: rest, o: stay ? 1 : 0 },
    ];
    piece(verts, BRIGHT, way, [0, 0], markDef);
  };

  const hsVs = vertsOf(hs);
  const hsTwin = reflectThrough(sqC, hsVs);
  const dSq = [Math.SQRT1_2, -Math.SQRT1_2] as const; // across the diagonal cut
  bisect(hsVs, inSquare(avg(hsVs)), off(inSquare(avg(hsVs)), dSq, 0.22), rowSlot(1), hs);
  bisect(hsTwin, inSquare(avg(hsTwin)), off(inSquare(avg(hsTwin)), dSq, -0.22), null);

  const hrVs = vertsOf(hr);
  const hrTwin = reflectThrough(rhC, hrVs);
  const dRh = [-0.9239, -0.3827] as const; // across the short-diagonal cut
  bisect(hrVs, inRhombus(avg(hrVs)), off(inRhombus(avg(hrVs)), dRh, 0.22), rowSlot(3), hr);
  bisect(hrTwin, inRhombus(avg(hrTwin)), off(inRhombus(avg(hrTwin)), dRh, -0.22), null);

  // ——— the complements: jug and almond cut out, the bipeds left behind
  const complement = (verts: XY[], home: XY, burst: XY, slot: XY, markDef: ElementDef): void => {
    piece(
      verts,
      BRIGHT,
      [
        { at: 0, c: home, o: 0 },
        { at: 0.415, c: home, o: 0 },
        { at: 0.46, c: burst, o: 1 },
        { at: 0.5, c: burst, o: 1 },
        { at: 0.6, c: slot, o: 1 },
        { at: 1, c: slot, o: 1 },
      ],
      [0, 0],
      markDef,
    );
  };

  const jgVs = vertsOf(jg);
  const lbVs = vertsOf(lb);
  const dDiag = [Math.SQRT1_2, Math.SQRT1_2] as const;
  complement(jgVs, inSquare(avg(jgVs)), off(inSquare(avg(jgVs)), dDiag, -0.22), rowSlot(4), jg);
  complement(lbVs, inSquare(avg(lbVs)), off(inSquare(avg(lbVs)), dDiag, 0.22), rowSlot(5), lb);

  const alVs = vertsOf(al);
  const sbVs = vertsOf(sb);
  const dLong = [0.9239, 0.3827] as const; // the rhombus's long diagonal
  complement(alVs, inRhombus(avg(alVs)), off(inRhombus(avg(alVs)), dLong, -0.22), rowSlot(6), al);
  complement(sbVs, inRhombus(avg(sbVs)), off(inRhombus(avg(sbVs)), dLong, 0.22), rowSlot(7), sb);

  // ——— letters into words: a corner of the real plate
  const patch = cornerPatch(plan, 14);
  const patchCenter = (() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < patch.coords.length; i += 3) {
      xs.push(patch.coords[i]!);
      ys.push(patch.coords[i + 1]!);
    }
    return [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
    ] as XY;
  })();
  const shifted: number[] = [];
  for (let i = 0; i < patch.coords.length; i += 3) {
    shifted.push(patch.coords[i]! - patchCenter[0] + 0, patch.coords[i + 1]! - patchCenter[1] + 1.3, Z);
  }
  const fragment = inkLines(shifted, 0.8, inkOptions);
  drawOn(fragment, 0);
  group.add(fragment);

  return { group, fragment, fragmentCount: patch.n, pieces };
}

const CAMERA_PATH: CameraKey[] = [
  { at: 0.0, pos: [0, -0.5, 6.6], target: [0, 0.9, 0] }, // the seeds
  { at: 0.5, pos: [0, -0.5, 6.6], target: [0, 0.9, 0] }, // held through the derivations
  { at: 0.62, pos: [0, -3.1, 11.2], target: [0, -0.72, 0] }, // the row revealed, clear of the caption band
  // wide enough that the corner patch AND the whole specimen row hold the
  // frame together, stacked above the caption band — no letter leaves the page
  { at: 0.72, pos: [0, -2.8, 15.6], target: [0, -0.9, 0] },
  { at: 0.88, pos: [0, -3.2, 16.4], target: [0, -1.05, 0] },
  { at: 1.0, pos: [0, -3.2, 16.4], target: [0, -1.05, 0] },
];

export function createScene3(
  objects: Scene3Objects & { pieces: Piece[] },
  stage: VaultStage,
  dom: Scene3Dom = {},
) {
  const pos = new Vector3();
  const tgt = new Vector3();

  return (p: number): void => {
    for (const piece of objects.pieces) {
      if (piece.draw[1] > 0) drawOn(piece.outline, span(p, piece.draw[0], piece.draw[1]));
      else drawOn(piece.outline, 1);
      let sg = 0;
      while (sg < piece.way.length - 2 && p > piece.way[sg + 1]!.at) sg++;
      const a = piece.way[sg]!;
      const b = piece.way[sg + 1]!;
      const t = b.at > a.at ? smooth((p - a.at) / (b.at - a.at)) : 1;
      if (piece.move) {
        const cx = a.c[0] + (b.c[0] - a.c[0]) * t;
        const cy = a.c[1] + (b.c[1] - a.c[1]) * t;
        piece.group.position.set(cx - piece.center[0], cy - piece.center[1], 0);
      }
      inkOpacity(piece.outline, piece.base * (a.o + (b.o - a.o) * t));
      if (piece.marks) drawOn(piece.marks, span(p, 0.6, 0.66));
    }

    // letters into words
    drawOn(objects.fragment, span(p, 0.68, 0.82));

    // camera
    sampleCameraPath(CAMERA_PATH, p, pos, tgt);
    stage.camera.position.copy(pos);
    fitCameraToObject(stage.camera, tgt, objects.group);
    stage.controls.target.copy(tgt);
    stage.controls.update();

    stage.applyLighting(LIGHTING.ember);

    if (dom.captionA) {
      dom.captionA.style.opacity = String(span(p, 0.03, 0.09) * (1 - span(p, 0.13, 0.18)));
    }
    if (dom.captionB) {
      dom.captionB.style.opacity = String(span(p, 0.17, 0.23) * (1 - span(p, 0.46, 0.52)));
    }
    if (dom.captionC) {
      dom.captionC.style.opacity = String(span(p, 0.56, 0.62) * (1 - span(p, 0.68, 0.74)));
    }
    if (dom.captionD) {
      dom.captionD.style.opacity = String(span(p, 0.78, 0.86));
    }
  };
}
