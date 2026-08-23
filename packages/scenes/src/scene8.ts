import { type LightingState, LIGHTING, type VaultStage } from '@muqarnas/render';
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

/** The key's azimuth through the scene: one full turn, eased at both ends. */
export function dayAzimuth(p: number): number {
  return DAY_START_DEG + 360 * span(p, 0.06, 0.94);
}

/** The whole day is one field of one state — the lock, as a function. */
export function dayState(p: number): LightingState {
  return { ...LIGHTING.rake, sun: { ...LIGHTING.rake.sun, azimuthDeg: dayAzimuth(p) } };
}

/** Beneath, near the axis: the funnel as a clock face. */
const CAMERA = { pos: [0.5, -2.5, -16] as const, target: [0, 0, 20] as const };

export function createScene8(parts: Scene8Parts, stage: VaultStage, dom: Scene8Dom = {}) {
  return (p: number): void => {
    parts.rig.update(cascadeTiers(1, parts.rig.maxTier));

    stage.camera.position.set(...CAMERA.pos);
    stage.controls.target.set(...CAMERA.target);
    stage.controls.update();

    stage.applyLighting(dayState(p));

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
