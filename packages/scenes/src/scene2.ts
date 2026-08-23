import { Group, Vector3, type LineSegments } from 'three';
import { COEFFICIENT_PER_MODULE, kashiProfile, type KashiProfile } from '@muqarnas/plan';
import { LIGHTING, type VaultStage } from '@muqarnas/render';
import { drawOn, inkLines, inkOpacity, smooth, span } from './ink.js';

/**
 * SCENE 2 — THE MODULE AND THE PROFILE. The measure.
 *
 * The first elevation of the piece: the camera stands and faces a wall of
 * drawing. One stroke — the miqyās — then the 1×2 frame, and then al-Kāshī's
 * recipe performed in order: strike the 30° oblique, divide it in five,
 * fold two fifths onto the vertical (the compass swing that FORCES the
 * facet height 2 − (3/5)√3 — nobody chose that number), complete the
 * equilateral triangle to find the arc's centre. Facet, sixth of a circle,
 * ramp — the profile every cell in the vault wears.
 *
 * Then the profile is measured: a tracer runs it at constant speed while a
 * sexagesimal counter bills the surface — the facet counts whole, the roof
 * tapers to the apex and counts half — and lands on the taʿdīl, exactly.
 * Al-Kāshī's own printed value runs a breath short, and the caption says
 * so, because the slip (in his factor digits; Dold-Samplonius 1992, 223)
 * is itself part of the record.
 *
 * Every coordinate here comes from kashiProfile() — the same construction
 * the lift builds from. Nothing is redrawn.
 */

export interface Scene2Objects {
  readonly group: Group;
  readonly moduleInk: LineSegments;
  readonly frame: LineSegments;
  readonly oblique: LineSegments;
  readonly divMarks: LineSegments;
  readonly foldArc: LineSegments;
  readonly triangle: LineSegments;
  readonly profileInk: LineSegments;
  readonly tracer: LineSegments;
  readonly mirror: LineSegments;
  readonly profile: KashiProfile;
}

export interface Scene2Dom {
  readonly captionA?: HTMLElement; // the miqyās
  readonly captionB?: HTMLElement; // the recipe
  readonly captionC?: HTMLElement; // the taʿdīl, with live digits
  readonly captionD?: HTMLElement; // two of them, face to face
  /** The counter inside caption C whose text runs to the taʿdīl. */
  readonly numerals?: HTMLElement;
}

const DIM = 0.42;
const BRIGHT = 0.95;
const TRACER_SAMPLES = 140;

/** Sexagesimal with fixed two-digit places so the count doesn't jitter. */
export function toSexagesimal(v: number, places = 4): string {
  const whole = Math.floor(v);
  let frac = v - whole;
  const digits: number[] = [];
  for (let i = 0; i < places; i++) {
    frac *= 60;
    const d = Math.min(59, Math.floor(frac + 1e-9));
    digits.push(d);
    frac -= d;
  }
  return `${whole};${digits.map((d) => String(d).padStart(2, '0')).join(',')}`;
}

const seg = (coords: number[], ...pts: Array<readonly [number, number]>) => {
  for (let i = 0; i + 1 < pts.length; i++) {
    coords.push(pts[i]![0], 0, pts[i]![1], pts[i + 1]![0], 0, pts[i + 1]![1]);
  }
};

export function makeScene2Objects(): Scene2Objects {
  const profile = kashiProfile();
  const { A, E, Z, H, T, divisions } = profile.construction;
  const { cx, cz, r, a0, a1 } = profile.arc;

  const group = new Group();
  const add = (coords: number[], opacity: number) => {
    const lines = inkLines(coords, opacity);
    drawOn(lines, 0);
    group.add(lines);
    return lines;
  };

  // the miqyās: one stroke
  const moduleCoords: number[] = [];
  seg(moduleCoords, [0, 0], [1, 0]);
  const moduleInk = add(moduleCoords, BRIGHT);

  // the 1×2 frame it commands, with module ticks at half height
  const frameCoords: number[] = [];
  seg(frameCoords, [0, 0], [0, 2]);
  seg(frameCoords, [1, 0], [1, 2]);
  seg(frameCoords, [0, 2], [1, 2]);
  seg(frameCoords, [0, 1], [0.07, 1]);
  seg(frameCoords, [1, 1], [0.93, 1]);
  const frame = add(frameCoords, 0.6);

  // 1. strike the oblique from the top corner, 30° below the upper line
  const obliqueCoords: number[] = [];
  seg(obliqueCoords, A, E);
  const oblique = add(obliqueCoords, DIM);

  // 2. divide it into five equal parts; Z is three fifths from the corner
  const dir = [E[0] - A[0], E[1] - A[1]] as const;
  const len = Math.hypot(dir[0], dir[1]);
  const perp = [-dir[1] / len, dir[0] / len] as const;
  const divCoords: number[] = [];
  for (const d of divisions) {
    const s = d === divisions[2] ? 0.06 : 0.035;
    seg(divCoords, [d[0] - perp[0] * s, d[1] - perp[1] * s], [d[0] + perp[0] * s, d[1] + perp[1] * s]);
  }
  const divMarks = add(divCoords, DIM);

  // 3. fold the two lower fifths about E down onto the vertical: the swing
  //    that lands on H and fixes the facet height
  const foldR = (2 / 5) * len;
  const foldA0 = Math.atan2(Z[1] - E[1], Z[0] - E[0]);
  const foldA1 = Math.atan2(H[1] - E[1], H[0] - E[0]);
  const foldCoords: number[] = [];
  const foldSteps = 24;
  for (let i = 0; i < foldSteps; i++) {
    const t0 = foldA0 + ((foldA1 - foldA0) * i) / foldSteps;
    const t1 = foldA0 + ((foldA1 - foldA0) * (i + 1)) / foldSteps;
    seg(
      foldCoords,
      [E[0] + foldR * Math.cos(t0), E[1] + foldR * Math.sin(t0)],
      [E[0] + foldR * Math.cos(t1), E[1] + foldR * Math.sin(t1)],
    );
  }
  const foldArc = add(foldCoords, DIM);

  // 4. the arc's centre completes the equilateral triangle Z–H–T
  const triCoords: number[] = [];
  seg(triCoords, H, T);
  seg(triCoords, T, Z);
  seg(triCoords, Z, H);
  seg(triCoords, [T[0] - 0.03, T[1]], [T[0] + 0.03, T[1]]);
  seg(triCoords, [T[0], T[1] - 0.03], [T[0], T[1] + 0.03]);
  const triangle = add(triCoords, DIM);

  // the profile itself: facet, sixth of a circle, ramp
  const profileCoords: number[] = [];
  const poly = profile.polyline(32);
  for (let i = 0; i + 1 < poly.length; i++) seg(profileCoords, poly[i]!, poly[i + 1]!);
  const profileInk = add(profileCoords, BRIGHT);

  // the tracer: the same path resampled uniformly by arc length, so its
  // reveal fraction IS the measured fraction
  const tracerCoords: number[] = [];
  for (let i = 0; i + 1 < TRACER_SAMPLES; i++) {
    seg(tracerCoords, profile.sample(i / (TRACER_SAMPLES - 1)), profile.sample((i + 1) / (TRACER_SAMPLES - 1)));
  }
  const tracer = add(tracerCoords, 1);

  // the mirror: the same profile faced about the apex line, base first
  const mirrorCoords: number[] = [];
  seg(mirrorCoords, [1, 0], [2, 0]);
  const mirrored = poly.map(([x, z]) => [2 - x, z] as [number, number]);
  for (let i = 0; i + 1 < mirrored.length; i++) seg(mirrorCoords, mirrored[i]!, mirrored[i + 1]!);
  const mirror = add(mirrorCoords, BRIGHT);

  return {
    group,
    moduleInk,
    frame,
    oblique,
    divMarks,
    foldArc,
    triangle,
    profileInk,
    tracer,
    mirror,
    profile,
  };
}

interface CamKey {
  readonly at: number;
  readonly pos: [number, number, number];
  readonly target: [number, number, number];
}

const CAMERA_PATH: CamKey[] = [
  { at: 0.0, pos: [0.5, -5.4, 1.02], target: [0.5, 0, 1.02] }, // facing the wall of drawing
  { at: 0.56, pos: [0.5, -5.4, 1.02], target: [0.5, 0, 1.02] }, // held through the recipe
  { at: 0.64, pos: [0.45, -4.5, 1.05], target: [0.45, 0, 1.05] }, // leaning in to measure
  { at: 0.78, pos: [0.45, -4.5, 1.05], target: [0.45, 0, 1.05] }, // held on the count
  { at: 0.94, pos: [1.0, -6.2, 1.02], target: [1.0, 0, 1.02] }, // back, centred on the pair
  { at: 1.0, pos: [1.0, -6.2, 1.02], target: [1.0, 0, 1.02] },
];

export function createScene2(objects: Scene2Objects, stage: VaultStage, dom: Scene2Dom = {}) {
  const pos = new Vector3();
  const tgt = new Vector3();
  const { profile } = objects;
  const totalLength = profile.factor + profile.curveLength;

  return (p: number): void => {
    // the measure, then the frame it commands
    drawOn(objects.moduleInk, span(p, 0.02, 0.08));
    drawOn(objects.frame, span(p, 0.1, 0.2));

    // the recipe, step by step
    drawOn(objects.oblique, span(p, 0.22, 0.27));
    drawOn(objects.divMarks, span(p, 0.27, 0.31));
    drawOn(objects.foldArc, span(p, 0.31, 0.36));
    drawOn(objects.triangle, span(p, 0.36, 0.41));

    // the profile inked over its scaffolding
    drawOn(objects.profileInk, span(p, 0.42, 0.54));

    // the scaffolding lifts away
    const scaffold = DIM * (1 - span(p, 0.55, 0.62));
    inkOpacity(objects.oblique, scaffold);
    inkOpacity(objects.divMarks, scaffold);
    inkOpacity(objects.foldArc, scaffold);
    inkOpacity(objects.triangle, scaffold);

    // the measuring: tracer at constant speed, base curve stepped back
    const measure = span(p, 0.6, 0.78);
    drawOn(objects.tracer, measure);
    inkOpacity(objects.profileInk, BRIGHT - 0.55 * span(p, 0.56, 0.62) + 0.55 * span(p, 0.8, 0.86));
    if (dom.numerals) {
      // the facet bills whole; the roof tapers to the apex and bills half
      const s = measure * totalLength;
      const billed = Math.min(s, profile.factor) + Math.max(0, s - profile.factor) / 2;
      dom.numerals.textContent = toSexagesimal(billed);
    }
    inkOpacity(objects.tracer, measure > 0 ? 1 - span(p, 0.86, 0.92) : 0);

    // two of them, face to face; the frame ghosts so the niche reads whole
    drawOn(objects.mirror, span(p, 0.82, 0.92));
    inkOpacity(objects.frame, 0.6 - 0.38 * span(p, 0.82, 0.9));

    // camera: an elevation, held; a lean; a step back
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

    // ink needs no instrument; the room stays at its late light
    stage.applyLighting(LIGHTING.ember);

    // captions
    if (dom.captionA) {
      dom.captionA.style.opacity = String(span(p, 0.03, 0.09) * (1 - span(p, 0.17, 0.23)));
    }
    if (dom.captionB) {
      dom.captionB.style.opacity = String(span(p, 0.24, 0.3) * (1 - span(p, 0.5, 0.56)));
    }
    if (dom.captionC) {
      dom.captionC.style.opacity = String(span(p, 0.58, 0.64) * (1 - span(p, 0.82, 0.88)));
    }
    if (dom.captionD) {
      dom.captionD.style.opacity = String(span(p, 0.9, 0.97));
    }
  };
}

/** The exact value the counter lands on — exposed for tests. */
export const TADIL = COEFFICIENT_PER_MODULE;
