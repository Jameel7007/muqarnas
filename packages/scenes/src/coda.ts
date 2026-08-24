import { LIGHTING, lerpLighting, type VaultStage } from '@muqarnas/render';
import { cascadeTiers, type RisingVaultRig } from './rig.js';
import { smooth } from './ink.js';

/**
 * THE CODA — the vault, in the viewer's hands.
 *
 * The user asked the right closing question: when do I get to just LOOK
 * at it? After the return, the piece opens its hands. The finished second
 * reading stands under the rake, and the viewer may drag to turn it —
 * rotation only, so the page still scrolls — from any side, from
 * underneath, for as long as they like. Until they take hold, the scroll
 * itself turns the building slowly; the first drag hands it over.
 */

export interface CodaParts {
  readonly rig: RisingVaultRig;
}

export interface CodaDom {
  readonly caption?: HTMLElement;
  readonly hint?: HTMLElement;
}

/**
 * The 9→coda dissolve holds the close's last frame — the point of ink in
 * the ember hush. The camera therefore WAITS on the site's first frame
 * (scene 9's exact ending stance) until the melt completes, and only then
 * swings out into the slow turn; the building fades back in where it
 * dissolved, and the ember brightens into the rake like a dawn.
 */
const REST = { pos: [0, -7, 58] as const, target: [0, 0, 0] as const };
const HOLD = 0.07;
const HANDOVER = 0.16;
const EMBER_END = { ...LIGHTING.ember, exposure: LIGHTING.ember.exposure * 0.86 };

export function createCoda(parts: CodaParts, stage: VaultStage, dom: CodaDom = {}) {
  let userDrove = false;
  stage.controls.addEventListener('start', () => {
    userDrove = true;
    if (dom.hint) dom.hint.style.opacity = '0';
  });
  stage.controls.enableZoom = false;
  stage.controls.enablePan = false;
  stage.controls.minPolarAngle = 0.05;
  stage.controls.maxPolarAngle = Math.PI - 0.05;

  return (p: number): void => {
    parts.rig.update(cascadeTiers(1, parts.rig.maxTier));

    if (!userDrove) {
      // still through the melt, then out into the turn; until the viewer
      // takes hold, the scroll turns the building
      const theta = (200 * Math.PI) / 180 + 1.35 * Math.PI * smooth((p - HANDOVER) / (1 - HANDOVER));
      const g = smooth((p - HOLD) / (HANDOVER - HOLD));
      stage.camera.position.set(
        REST.pos[0] + (48 * Math.cos(theta) - REST.pos[0]) * g,
        REST.pos[1] + (48 * Math.sin(theta) - REST.pos[1]) * g,
        REST.pos[2] + (15 - REST.pos[2]) * g,
      );
      stage.controls.target.set(REST.target[0], REST.target[1], REST.target[2] + 13 * g);
    }
    stage.controls.update();

    stage.applyLighting(lerpLighting(EMBER_END, LIGHTING.rake, smooth((p - 0.02) / 0.18)));

    if (dom.caption) {
      dom.caption.style.opacity = String(smooth(Math.min(1, p / 0.12)) * (1 - smooth((p - 0.7) / 0.2)));
    }
    if (dom.hint && !userDrove) {
      dom.hint.style.opacity = p > 0.09 ? '1' : '0';
    }
  };
}
