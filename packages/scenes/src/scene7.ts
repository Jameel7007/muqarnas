import { Box3, Vector3, type LineBasicMaterial, type LineSegments, type Object3D } from 'three';
import { LIGHTING, lerpLighting, type VaultStage } from '@muqarnas/render';
import { fitCameraToBox, sampleCameraPath, type CameraKey } from './camera.js';
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

/** Scene 6 hands the complete vault over from this exterior flank. */
const EXIT_FROM = { pos: [15, -28, 18] as const, target: [0, 0, 13] as const };

const CAMERA_PATH: CameraKey[] = [
  { at: 0, ...EXIT_FROM },
  // One broad, monotonic crane move replaces the short half-orbit that
  // twisted around the vault and then immediately reversed toward plan view.
  { at: 0.18, pos: [13, -31, 25], target: [0, 0, 10] },
  { at: 0.36, pos: [7, -23, 42], target: [0, 0, 4] },
  { at: 0.5, pos: [0, -6, 56], target: [0, 0, 0] }, // overhead: the drawing again
  { at: 0.56, pos: [0, -6, 56], target: [0, 0, 0] }, // let the coincident plan breathe
  { at: 0.76, pos: [-24, -27, 20], target: [0, 0, 8] }, // down the other side
  { at: 1.0, pos: [-26, -17, 7], target: [0, 0, 12] }, // looking up at the second building
];

/** A and B under different hours of the same light. */
const RAKE_A = LIGHTING.rake;
const RAKE_B = { ...LIGHTING.rake, sun: { ...LIGHTING.rake.sun, azimuthDeg: 150 } };

export function createScene7(parts: Scene7Parts, stage: VaultStage, dom: Scene7Dom = {}) {
  const pos = new Vector3();
  const tgt = new Vector3();
  // Capture one stable envelope before either rig begins to move. Refitting
  // to the live geometry made the camera pump whenever the identity of the
  // highest surviving tier changed during collapse/reconstruction.
  parts.rigA.geometry.computeBoundingBox();
  parts.rigB.geometry.computeBoundingBox();
  const frameBounds = new Box3();
  if (parts.rigA.geometry.boundingBox) frameBounds.copy(parts.rigA.geometry.boundingBox);
  if (parts.rigB.geometry.boundingBox) frameBounds.union(parts.rigB.geometry.boundingBox);

  return (p: number): void => {
    // A: stands complete out of scene 6, holds, then descends
    const descend = span(p, 0.22, 0.5);
    const gA = 1 - descend;
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

    // camera: one continuous exterior rise into the drawing, followed by
    // the second reading's descent on the opposite side
    sampleCameraPath(CAMERA_PATH, p, pos, tgt);
    stage.camera.position.copy(pos);
    fitCameraToBox(stage.camera, tgt, frameBounds);
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
