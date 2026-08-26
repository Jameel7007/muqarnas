import { Vector3 } from 'three';
import { LIGHTING, type VaultStage } from '@muqarnas/render';
import { cascadeTiers, type RisingVaultRig } from './rig.js';

/**
 * THE FREE-LOOK CODA.
 *
 * The narrative now ends cleanly in scene IX: vault to plan, plan to
 * module, module to point. Free-look is a separate instrument after that
 * ending, entered deliberately rather than mixed into the scroll scrub.
 * While it is open OrbitControls owns the canvas; while it is closed the
 * page owns touch again.
 */

export interface CodaParts {
  readonly rig: RisingVaultRig;
}

export interface CodaDom {
  readonly hint?: HTMLElement;
  /** The light bar's container. */
  readonly panel?: HTMLElement;
  /** Azimuth slider 0–360; its value is offset from the rake's hour. */
  readonly light?: HTMLInputElement;
}

export interface CodaController {
  open(): void;
  close(): void;
  /** Refit after a viewport change without discarding the user's orbit. */
  resize(): void;
}

/** The rake's own azimuth — the slider's neutral centre. */
const RAKE_AZ = LIGHTING.rake.sun.azimuthDeg;

export function createCoda(
  parts: CodaParts,
  stage: VaultStage,
  dom: CodaDom = {},
): CodaController {
  let open = false;

  stage.controls.addEventListener('start', () => {
    if (!open) return;
    if (dom.hint) dom.hint.style.opacity = '0';
  });

  stage.controls.enablePan = false;
  stage.controls.minPolarAngle = 0.05;
  stage.controls.maxPolarAngle = Math.PI - 0.05;
  stage.controls.enableZoom = true;
  stage.controls.minDistance = 6;
  stage.controls.maxDistance = 140;

  // Plain wheel input never zooms the model; ctrl-wheel and touch pinch do.
  const surface = (stage.controls as unknown as { domElement?: HTMLElement }).domElement;
  if (surface) {
    surface.addEventListener(
      'wheel',
      (event) => {
        stage.controls.enableZoom = (event as WheelEvent).ctrlKey;
      },
      { capture: true, passive: true },
    );
    surface.addEventListener(
      'touchstart',
      () => {
        stage.controls.enableZoom = true;
      },
      { capture: true, passive: true },
    );
  }

  // The whole building, always: the bounding sphere fits in both axes, so
  // the first drag cannot crop the vault on a tall phone.
  const sphere =
    (parts.rig as { geometry?: { boundingSphere?: { center: Vector3; radius: number } | null } })
      .geometry?.boundingSphere ?? null;
  const centre = sphere ? sphere.center.clone() : new Vector3(0, 0, 11);
  const radius = sphere ? sphere.radius : 27;
  const fitDistance = () => {
    const fov = (stage.camera as { fov?: number }).fov ?? 44;
    const aspect = (stage.camera as { aspect?: number }).aspect ?? 16 / 9;
    const vertical = (fov * Math.PI) / 360;
    const horizontal = Math.atan(Math.tan(vertical) * aspect);
    return (radius * 1.06) / Math.sin(Math.min(vertical, horizontal));
  };
  const canonicalDirection = new Vector3(
    Math.cos(-0.14) * Math.cos((200 * Math.PI) / 180),
    Math.cos(-0.14) * Math.sin((200 * Math.PI) / 180),
    Math.sin(-0.14),
  );
  const fitAlong = (direction: Vector3) => {
    const offset =
      direction.lengthSq() > 1e-12 ? direction.normalize() : canonicalDirection.clone();
    stage.camera.position.copy(offset.multiplyScalar(fitDistance()).add(centre));
    stage.controls.target.copy(centre);
    stage.controls.update();
  };

  const applyLight = () => {
    const turn = dom.light ? Number(dom.light.value) - RAKE_AZ : 0;
    stage.applyLighting({
      ...LIGHTING.rake,
      sun: { ...LIGHTING.rake.sun, azimuthDeg: LIGHTING.rake.sun.azimuthDeg + turn },
    });
  };
  dom.light?.addEventListener('input', applyLight);

  return {
    open() {
      open = true;
      parts.rig.update(cascadeTiers(1, parts.rig.maxTier));
      fitAlong(canonicalDirection.clone());
      stage.controls.enabled = true;
      if (surface) surface.style.touchAction = 'none';

      applyLight();
      if (dom.hint) dom.hint.style.opacity = '1';
      if (dom.panel) {
        dom.panel.style.opacity = '1';
        dom.panel.style.pointerEvents = 'auto';
      }
    },

    close() {
      open = false;
      stage.controls.enabled = false;
      if (surface) surface.style.touchAction = 'pan-y';
      if (dom.hint) dom.hint.style.opacity = '0';
      if (dom.panel) {
        dom.panel.style.opacity = '0';
        dom.panel.style.pointerEvents = 'none';
      }
    },

    resize() {
      if (!open) return;
      fitAlong(stage.camera.position.clone().sub(centre));
    },
  };
}
