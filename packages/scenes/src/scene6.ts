import { Box3, Vector3, type LineBasicMaterial, type LineSegments } from 'three';
import { LIGHTING, lerpLighting, type VaultStage } from '@muqarnas/render';
import { fitCameraToGeometry, sampleCameraPath, type CameraKey } from './camera.js';
import { cascadeTiers, type RisingVaultRig } from './rig.js';

/**
 * SCENE 6 — TIER ON TIER. The ascent.
 *
 * Scene 5 ended among the corner cells with one tier standing; scene 7
 * opens on the finished building. This scene is the whole distance
 * between: ring after ring rises out of the plan, each standing on the
 * roofs of the ring below, while the camera drifts from the corner to the
 * centre of the floor and watches the ceiling assemble overhead. The
 * light crosses from the reading state back into the rake as the cells
 * gain the depth the language needs — the building is finished under its
 * signature light. At the top the crown closes to a ring, not a point —
 * the plan was an annulus all along — and the camera steps calmly outside
 * to hand the completed building to the next scene.
 *
 * Opens in scene 5's exact final state (tier 1 alone — the climb curve
 * maxes the cascade with that base so nothing pre-rises) and ends in
 * scene 7's exact opening state (complete vault under RAKE_A).
 */

export interface Scene6Parts {
  readonly rig: RisingVaultRig;
  /** Height of the crown ring — the display geometry's top. */
  readonly crownZ: number;
  /** The faint drawing the first tier stands on; consumed as the rest rises. */
  readonly planLines?: LineSegments;
}

export interface Scene6Dom {
  readonly captionA?: HTMLElement; // each ring stands on the last
  readonly captionB?: HTMLElement; // the cells begin to cup the light
  readonly captionC?: HTMLElement; // the crown closes to a ring
}

const smooth = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
};
const span = (p: number, a: number, b: number) => smooth((p - a) / (b - a));

/**
 * The ascent's tier curve: the bottom-up cascade, held to at least the
 * standing first tier so g = 0 is exactly scene 5's final state.
 */
export function climbCurve(g: number, maxTier: number): (tier: number) => number {
  const cascade = cascadeTiers(g, maxTier);
  return (tier) => Math.max(tier === 1 ? 1 : 0, cascade(tier));
}

/** Scene 5 hands over at this key; scene 6 must open exactly there. */
const HANDOFF: { pos: [number, number, number]; target: [number, number, number] } = {
  pos: [15, -26, 15],
  target: [0, -1, 1],
};

/** Scene 7 opens under this hour; the ascent finishes into it. */
const RAKE_A = LIGHTING.rake;

export function createScene6(parts: Scene6Parts, stage: VaultStage, dom: Scene6Dom = {}) {
  const pos = new Vector3();
  const tgt = new Vector3();
  const frameBounds = new Box3();

  const path: CameraKey[] = [
    { at: 0.0, pos: HANDOFF.pos, target: HANDOFF.target }, // among the corner cells
    // stepping over the standing first ring — tier 2 is still flat this early,
    // which is what keeps the move clear of the masonry
    { at: 0.16, pos: [18, -15, 4], target: [2, 0, 6] },
    { at: 0.42, pos: [26, -18, 15], target: [0, 0, 10] }, // the cone climbing
    { at: 0.66, pos: [16, 20, 24], target: [0, 0, 16] }, // orbiting as the rings close
    { at: 0.82, pos: [25, -4, 20], target: [0, 0, 16] }, // widening around the complete vault
    // Continue out along the same flank. Diving beneath the crown here made
    // the following exterior reveal read as a flip rather than one camera move.
    { at: 1.0, pos: [15, -28, 18], target: [0, 0, 13] },
  ];

  return (p: number): void => {
    // the climb: one scalar, seventeen rings
    parts.rig.update(climbCurve(span(p, 0.05, 0.78), parts.rig.maxTier));

    // the drawing is consumed by what it becomes
    if (parts.planLines) {
      const m = parts.planLines.material as LineBasicMaterial;
      m.opacity = 0.15 * (1 - span(p, 0.05, 0.45));
      parts.planLines.visible = m.opacity > 0.01;
    }

    // camera
    sampleCameraPath(path, p, pos, tgt);
    stage.camera.position.copy(pos);
    fitCameraToGeometry(stage.camera, tgt, parts.rig.geometry, frameBounds);
    stage.controls.target.copy(tgt);
    stage.controls.update();

    // light: out of scene 5's corner rake, through the working light, and
    // back into the signature as the cells gain their depth
    const toCourt = span(p, 0.08, 0.3);
    const toRake = span(p, 0.45, 0.82);
    stage.applyLighting(
      toRake > 0
        ? lerpLighting(LIGHTING.court, RAKE_A, toRake)
        : lerpLighting(
            { ...LIGHTING.rake, sun: { ...LIGHTING.rake.sun, azimuthDeg: 195 } },
            LIGHTING.court,
            toCourt,
          ),
    );

    // captions
    if (dom.captionA) {
      dom.captionA.style.opacity = String(span(p, 0.04, 0.1) * (1 - span(p, 0.2, 0.28)));
    }
    if (dom.captionB) {
      dom.captionB.style.opacity = String(span(p, 0.42, 0.48) * (1 - span(p, 0.6, 0.68)));
    }
    if (dom.captionC) {
      dom.captionC.style.opacity = String(span(p, 0.82, 0.9) * (1 - span(p, 0.94, 0.99)));
    }
  };
}
