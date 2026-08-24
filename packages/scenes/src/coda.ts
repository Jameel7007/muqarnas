import { LIGHTING, type VaultStage } from '@muqarnas/render';
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
      // until the viewer takes hold, the scroll turns the building
      const theta = (200 * Math.PI) / 180 + 1.35 * Math.PI * smooth(p);
      stage.camera.position.set(48 * Math.cos(theta), 48 * Math.sin(theta), 15);
      stage.controls.target.set(0, 0, 13);
    }
    stage.controls.update();

    stage.applyLighting(LIGHTING.rake);

    if (dom.caption) {
      dom.caption.style.opacity = String(smooth(Math.min(1, p / 0.12)) * (1 - smooth((p - 0.7) / 0.2)));
    }
    if (dom.hint && !userDrove) {
      dom.hint.style.opacity = p > 0.04 ? '1' : '0';
    }
  };
}
