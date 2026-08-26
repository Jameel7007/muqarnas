import { Box3 } from 'three';
import { type LightingState, LIGHTING, lerpLighting, type VaultStage } from '@muqarnas/render';
import { fitCameraToGeometry } from './camera.js';
import { cascadeTiers, type RisingVaultRig } from './rig.js';
import { smooth } from './ink.js';

/**
 * SCENE 8 — THE DAY. The subject, alone.
 *
 * The lighting language locked this scene's rule before any scene was
 * built: rake is "Scene 8's state: nothing moves except this key's
 * azimuth." So nothing does. The camera stands beneath the finished vault
 * — the view the whole language exists for — and holds, while the low key
 * walks the full horizon: out of scene 7's hour (azimuth 150), all the
 * way around, and back to it. Every cell is a cup set at its own angle;
 * as the key walks, each fills and empties in its own time. The sun is
 * the only thing that moves, and nothing looks the same twice.
 *
 * The scene asserts the second reading at full height each frame, so it
 * is correct even when entered by a jump rather than through scene 7.
 */

export interface Scene8Parts {
  readonly rig: RisingVaultRig;
}

export interface Scene8Dom {
  readonly captionA?: HTMLElement; // nothing will move but the sun
  readonly captionB?: HTMLElement; // each cell a cup at its own angle
  readonly captionC?: HTMLElement; // it returns; nothing looked the same twice
}

const span = (p: number, a: number, b: number) => smooth((p - a) / (b - a));

/** Scene 7 hands over at RAKE_B's hour; the day leaves it and returns to it. */
export const DAY_START_DEG = 150;

/**
 * The day's own rake: the under-light pushed to be emphatic — hotter key,
 * a shade more exposure, the ambience held back so the blade dominates.
 * CONSTANT for the whole scene: the lock still means what it says, because
 * nothing about this state ever changes except the azimuth.
 */
export const DAY_RAKE: LightingState = {
  ...LIGHTING.rake,
  exposure: LIGHTING.rake.exposure + 0.08,
  hemisphere: { ...LIGHTING.rake.hemisphere, intensity: LIGHTING.rake.hemisphere.intensity * 0.72 },
  sun: { ...LIGHTING.rake.sun, intensity: LIGHTING.rake.sun.intensity * 1.35 },
};

/** The key's azimuth: one full turn, eased, beginning once the camera stands. */
export function dayAzimuth(p: number): number {
  return DAY_START_DEG + 360 * span(p, 0.06, 0.96);
}

/**
 * v2.2 — the sun also climbs: low blades at morning and evening, higher
 * at noon, exactly like a day. The lock's spirit holds, restated: nothing
 * moves except THE SUN. Endpoints return to the rake's own elevation so
 * both handoffs stay seamless.
 */
export function dayElevation(p: number): number {
  const sweep = span(p, 0.06, 0.96);
  return DAY_RAKE.sun.elevationDeg + 6.5 * Math.sin(Math.PI * sweep);
}

/** The whole day is one field of one state — the lock, as a function. */
export function dayState(p: number): LightingState {
  return {
    ...DAY_RAKE,
    sun: { ...DAY_RAKE.sun, azimuthDeg: dayAzimuth(p), elevationDeg: dayElevation(p) },
  };
}

/**
 * The scene ARRIVES before it stands: a short approach out of scene 7's
 * final stance, passing under the rim into the beneath position — the
 * spatial jump from outside to underneath was the one abrupt thing left
 * in the cut. Once the day begins, the camera is locked: nothing moves
 * except the key's azimuth, exactly as the language wrote it.
 */
const ARRIVE_FROM = { pos: [-26, -17, 7] as const, target: [0, 0, 12] as const };
const CAMERA = { pos: [0.5, -2.5, -16] as const, target: [0, 0, 20] as const };

/**
 * The 7→8 dissolve holds scene 7's last frame; a camera moving beneath it
 * smears as a double-exposure. So the approach WAITS at scene 7's stance
 * until the melt completes, then passes under the rim. The light likewise
 * eases from the handoff hour into the day's own rake before the sun
 * starts walking — the day proper still moves nothing but the sun.
 */
const ARRIVE_HOLD = 0.04;
const ARRIVE_UNTIL = 0.12;
const HANDOFF: LightingState = {
  ...LIGHTING.rake,
  sun: { ...LIGHTING.rake.sun, azimuthDeg: DAY_START_DEG },
};

const smoothstep = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
};

export function createScene8(parts: Scene8Parts, stage: VaultStage, dom: Scene8Dom = {}) {
  const frameBounds = new Box3();

  return (p: number): void => {
    parts.rig.update(cascadeTiers(1, parts.rig.maxTier));

    const arrive = smoothstep((p - ARRIVE_HOLD) / (ARRIVE_UNTIL - ARRIVE_HOLD));
    stage.camera.position.set(
      ARRIVE_FROM.pos[0] + (CAMERA.pos[0] - ARRIVE_FROM.pos[0]) * arrive,
      ARRIVE_FROM.pos[1] + (CAMERA.pos[1] - ARRIVE_FROM.pos[1]) * arrive,
      ARRIVE_FROM.pos[2] + (CAMERA.pos[2] - ARRIVE_FROM.pos[2]) * arrive,
    );
    stage.controls.target.set(
      ARRIVE_FROM.target[0] + (CAMERA.target[0] - ARRIVE_FROM.target[0]) * arrive,
      ARRIVE_FROM.target[1] + (CAMERA.target[1] - ARRIVE_FROM.target[1]) * arrive,
      ARRIVE_FROM.target[2] + (CAMERA.target[2] - ARRIVE_FROM.target[2]) * arrive,
    );
    fitCameraToGeometry(stage.camera, stage.controls.target, parts.rig.geometry, frameBounds);
    stage.controls.update();

    const toDay = smoothstep((p - 0.005) / 0.05);
    stage.applyLighting(toDay >= 1 ? dayState(p) : lerpLighting(HANDOFF, dayState(p), toDay));

    if (dom.captionA) {
      dom.captionA.style.opacity = String(span(p, 0.03, 0.09) * (1 - span(p, 0.15, 0.21)));
    }
    if (dom.captionB) {
      dom.captionB.style.opacity = String(span(p, 0.44, 0.5) * (1 - span(p, 0.6, 0.66)));
    }
    if (dom.captionC) {
      dom.captionC.style.opacity = String(span(p, 0.9, 0.96));
    }
  };
}
