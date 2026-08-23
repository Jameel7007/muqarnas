import { Vector3, type LineSegments, type LineBasicMaterial } from 'three';
import { LIGHTING, lerpLighting, type VaultStage } from '@muqarnas/render';
import type { RisingVaultRig } from './rig.js';

/**
 * SCENE 5 — THE LIFT. The hinge moment of the site.
 *
 * The camera leaves the plane for the first time. The plan lies flat — a
 * drawing — then each first-tier tile rises into its cell along the
 * profile, in a sweep around the axis. For this vault "first tier" means
 * the corners: the Takht-i Sulaymān readings all start there, so the
 * corners ignite first, which is the finding as choreography.
 *
 * One scalar drives everything (ScrollTrigger scrubs it): the tier-1 rise,
 * the camera's descent from the drawing-view into three-quarter closeness,
 * the light crossing from court into rake — the cells literally rise into
 * the from-below light — and the captions' breath.
 */

export interface Scene5Dom {
  readonly captionA?: HTMLElement; // the plan, before
  readonly captionB?: HTMLElement; // the first tier, after
}

export interface Scene5Extras {
  /** the plan-as-drawing layer, dissolved as the tiles rise */
  readonly planLines?: LineSegments;
}

const smooth = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
};
const span = (p: number, a: number, b: number) => smooth((p - a) / (b - a));

interface CamKey {
  readonly at: number;
  readonly pos: [number, number, number];
  readonly target: [number, number, number];
}

const CAMERA_PATH: CamKey[] = [
  { at: 0.0, pos: [0, -7, 58], target: [0, 0, 0] }, // the drawing, from above
  { at: 0.5, pos: [2, -36, 30], target: [0, 0, 1.5] }, // leaving the plane
  { at: 1.0, pos: [15, -26, 15], target: [0, -1, 1] }, // the first ring whole, a crown on the drawing
];

/**
 * the rake swung nearly into the east row's facing, so the standing cells
 * read as a receding rhythm of lit cups — each bowl cross-lit, the far
 * row beyond the corner left dark
 */
const RAKE_END = {
  ...LIGHTING.rake,
  sun: { ...LIGHTING.rake.sun, azimuthDeg: 195 },
};

export function createScene5(
  rig: RisingVaultRig,
  stage: VaultStage,
  dom: Scene5Dom = {},
  extras: Scene5Extras = {},
) {
  const pos = new Vector3();
  const tgt = new Vector3();

  return (p: number): void => {
    // the rise: tier 1 only; everything above stays a drawing
    const rise = span(p, 0.12, 0.78);
    rig.update((tier) => (tier === 1 ? rise : 0));

    // the ink recedes as matter rises — but never quite leaves: the rest of
    // the vault is still only a drawing, and the standing tier stands on it
    if (extras.planLines) {
      const m = extras.planLines.material as LineBasicMaterial;
      m.opacity = 0.85 - 0.7 * span(p, 0.15, 0.7);
      extras.planLines.visible = m.opacity > 0.01;
    }

    // camera along the path
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

    // light: court while reading, crossing to rake as the cells gain depth;
    // a gentle exposure ramp rides on top for the flat drawing
    const cross = span(p, 0.35, 0.82);
    const state = lerpLighting(LIGHTING.court, RAKE_END, cross);
    stage.applyLighting({ ...state, exposure: state.exposure + 0.25 * (1 - span(p, 0.05, 0.45)) });

    // captions breathe
    if (dom.captionA) {
      dom.captionA.style.opacity = String(span(p, 0.02, 0.08) * (1 - span(p, 0.14, 0.24)));
    }
    if (dom.captionB) {
      dom.captionB.style.opacity = String(span(p, 0.72, 0.84) * (1 - span(p, 0.96, 1)));
    }
  };
}
