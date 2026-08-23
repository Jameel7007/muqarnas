import { Vector3, type LineBasicMaterial, type LineSegments, type Object3D } from 'three';
import { LIGHTING, lerpLighting, type VaultStage } from '@muqarnas/render';
import { cascadeTiers, type RisingVaultRig } from './rig.js';

/**
 * SCENE 7 — THE SAME PLAN, TWICE. The climax.
 *
 * The vault descends back into its plan, top-down, tier under tier. The
 * plan holds — the ink returns, the drawing lies flat and unchanged. Then
 * it rises again, differently: another valid reading of the same lines,
 * another building. The swap happens inside the coincidence: at height
 * zero both vaults ARE the plan, so no crossfade is needed, only the
 * moment. The caption carries the real content — the drawing does not
 * determine the building, and the master's knowledge was never fully in
 * the plan.
 *
 * Reading-agnostic: any two solutions of the solver may play A and B.
 */

export interface Scene7Parts {
  readonly rigA: RisingVaultRig;
  readonly rigB: RisingVaultRig;
  readonly meshA: Object3D;
  readonly meshB: Object3D;
  readonly planLines?: LineSegments;
}

export interface Scene7Dom {
  readonly captionA?: HTMLElement; // one reading of the drawing
  readonly captionB?: HTMLElement; // the plan holds
  readonly captionC?: HTMLElement; // the thesis
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
  { at: 0.0, pos: [20, -26, 14], target: [0, 0, 8] }, // the vault completes
  { at: 0.24, pos: [10, -34, 30], target: [0, 0, 6] }, // drifting upward as it descends
  { at: 0.5, pos: [0, -6, 56], target: [0, 0, 0] }, // overhead: the drawing again
  { at: 0.76, pos: [-24, -27, 20], target: [0, 0, 8] }, // down the other side
  { at: 1.0, pos: [-26, -17, 7], target: [0, 0, 12] }, // looking up at the second building
];

/** A and B under different hours of the same light. */
const RAKE_A = LIGHTING.rake;
const RAKE_B = { ...LIGHTING.rake, sun: { ...LIGHTING.rake.sun, azimuthDeg: 150 } };

export function createScene7(parts: Scene7Parts, stage: VaultStage, dom: Scene7Dom = {}) {
  const pos = new Vector3();
  const tgt = new Vector3();

  return (p: number): void => {
    // A: completes (a compressed nod to scene 6), holds, then descends
    const complete = span(p, 0, 0.14);
    const descend = span(p, 0.22, 0.5);
    const gA = (0.12 + 0.88 * complete) * (1 - descend);
    parts.rigA.update(cascadeTiers(gA, parts.rigA.maxTier));

    // B: rises out of the same flatness
    const gB = span(p, 0.56, 0.9);
    parts.rigB.update(cascadeTiers(gB, parts.rigB.maxTier));

    // the swap lives inside the coincidence
    parts.meshA.visible = p < 0.53;
    parts.meshB.visible = p >= 0.53;

    // the ink returns while the plan holds
    if (parts.planLines) {
      const m = parts.planLines.material as LineBasicMaterial;
      m.opacity = 0.85 * span(p, 0.4, 0.5) * (1 - span(p, 0.56, 0.68));
      parts.planLines.visible = m.opacity > 0.01;
    }

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

    // light: A's hour, into the reading light while the plan holds, then B's hour
    const toCourt = span(p, 0.28, 0.48);
    const toB = span(p, 0.58, 0.84);
    const state =
      toB > 0
        ? lerpLighting(LIGHTING.court, RAKE_B, toB)
        : lerpLighting(RAKE_A, LIGHTING.court, toCourt);
    stage.applyLighting(state);

    // captions
    if (dom.captionA) {
      dom.captionA.style.opacity = String(span(p, 0.04, 0.12) * (1 - span(p, 0.2, 0.28)));
    }
    if (dom.captionB) {
      dom.captionB.style.opacity = String(span(p, 0.44, 0.5) * (1 - span(p, 0.54, 0.62)));
    }
    if (dom.captionC) {
      dom.captionC.style.opacity = String(span(p, 0.88, 0.96));
    }
  };
}
