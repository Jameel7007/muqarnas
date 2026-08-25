import { Vector3 } from 'three';
import { LIGHTING, lerpLighting, type VaultStage } from '@muqarnas/render';
import { cascadeTiers, type RisingVaultRig } from './rig.js';
import { smooth } from './ink.js';
import { prefersReducedMotion } from './motion.js';

/**
 * THE CODA — the vault, in the viewer's hands.
 *
 * The user asked the right closing question: when do I get to just LOOK
 * at it? After the return, the piece opens its hands. The finished second
 * reading stands under the rake, and the viewer may drag to turn it —
 * from any side, from underneath, for as long as they like. Until they
 * take hold, the scroll itself turns the building slowly; the first drag
 * hands it over.
 *
 * Framing rule: the untouched orbit rides at the distance where the
 * building's bounding sphere fits the frustum from EVERY direction, so
 * no drag can crop it — leaving that framing is a deliberate act (pinch
 * or ctrl-scroll to zoom; a plain scroll remains the page's). And the
 * viewer holds the light too: a small bar walks the low sun around the
 * horizon, scene 8's freedom handed over.
 */

export interface CodaParts {
  readonly rig: RisingVaultRig;
}

export interface CodaDom {
  readonly caption?: HTMLElement;
  readonly hint?: HTMLElement;
  /** the light bar's container — shown and hidden with the coda */
  readonly panel?: HTMLElement;
  /** azimuth slider 0–360; its value is offset-mapped from the rake's hour */
  readonly light?: HTMLInputElement;
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

/** The rake's own azimuth — the slider's neutral centre. */
const RAKE_AZ = LIGHTING.rake.sun.azimuthDeg;

export function createCoda(parts: CodaParts, stage: VaultStage, dom: CodaDom = {}) {
  // under prefers-reduced-motion the coda does not drive itself: the camera
  // rests on the site's first frame and the building turns only by drag
  const reduced = prefersReducedMotion();
  let userDrove = false;
  stage.controls.addEventListener('start', () => {
    userDrove = true;
    if (dom.hint) dom.hint.style.opacity = '0';
  });
  stage.controls.enablePan = false;
  stage.controls.minPolarAngle = 0.05;
  stage.controls.maxPolarAngle = Math.PI - 0.05;
  // zoom is deliberate: trackpad pinch and ctrl-scroll (both report
  // ctrlKey) dolly, a plain wheel stays the page's scroll. OrbitControls
  // checks enableZoom before touching the event, so toggling it in a
  // capture listener routes each gesture; touch pinch re-arms it.
  stage.controls.enableZoom = true;
  stage.controls.minDistance = 6;
  stage.controls.maxDistance = 140;
  const surface = (stage.controls as unknown as { domElement?: HTMLElement }).domElement;
  if (surface) {
    surface.addEventListener(
      'wheel',
      (e) => {
        stage.controls.enableZoom = (e as WheelEvent).ctrlKey;
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

  // the whole building, always: orbit about the bounding sphere's centre
  // at the distance where the sphere fits the frustum in BOTH axes — a
  // framing no rotation can break
  const bs =
    (parts.rig as { geometry?: { boundingSphere?: { center: Vector3; radius: number } | null } })
      .geometry?.boundingSphere ?? null;
  const centre = bs ? bs.center.clone() : new Vector3(0, 0, 11);
  const radius = bs ? bs.radius : 27;
  const fitDistance = () => {
    const fov = (stage.camera as { fov?: number }).fov ?? 44;
    const aspect = (stage.camera as { aspect?: number }).aspect ?? 16 / 9;
    const v = (fov * Math.PI) / 360;
    const h = Math.atan(Math.tan(v) * aspect);
    return (radius * 1.06) / Math.sin(Math.min(v, h));
  };

  let lastP = 0;
  const applyLight = (p: number) => {
    const dawn = smooth((p - 0.02) / 0.18);
    const base = lerpLighting(EMBER_END, LIGHTING.rake, dawn);
    // the slider walks the sun as an offset from the rake's hour, scaled
    // by the dawn so the ember handoff stays seamless
    const turn = dom.light ? Number(dom.light.value) - RAKE_AZ : 0;
    stage.applyLighting({ ...base, sun: { ...base.sun, azimuthDeg: base.sun.azimuthDeg + turn * dawn } });
  };
  // the stage renders every frame, but scene updates only run on scroll —
  // the light bar must speak for itself while the page rests
  dom.light?.addEventListener('input', () => applyLight(lastP));

  return (p: number): void => {
    lastP = p;
    parts.rig.update(cascadeTiers(1, parts.rig.maxTier));

    if (!userDrove) {
      // still through the melt, then out into the turn; until the viewer
      // takes hold, the scroll turns the building — slightly from beneath
      const theta = (200 * Math.PI) / 180 + 1.35 * Math.PI * smooth((p - HANDOVER) / (1 - HANDOVER));
      const g = reduced ? 0 : smooth((p - HOLD) / (HANDOVER - HOLD));
      const d = fitDistance();
      const phi = -0.14;
      const ox = centre.x + d * Math.cos(phi) * Math.cos(theta);
      const oy = centre.y + d * Math.cos(phi) * Math.sin(theta);
      const oz = centre.z + d * Math.sin(phi);
      stage.camera.position.set(
        REST.pos[0] + (ox - REST.pos[0]) * g,
        REST.pos[1] + (oy - REST.pos[1]) * g,
        REST.pos[2] + (oz - REST.pos[2]) * g,
      );
      stage.controls.target.set(
        REST.target[0] + (centre.x - REST.target[0]) * g,
        REST.target[1] + (centre.y - REST.target[1]) * g,
        REST.target[2] + (centre.z - REST.target[2]) * g,
      );
    }
    stage.controls.update();

    applyLight(p);

    if (dom.caption) {
      dom.caption.style.opacity = String(smooth(Math.min(1, p / 0.12)) * (1 - smooth((p - 0.7) / 0.2)));
    }
    if (dom.hint && !userDrove) {
      dom.hint.style.opacity = p > 0.09 ? '1' : '0';
    }
    if (dom.panel) {
      const o = smooth((p - 0.1) / 0.08);
      dom.panel.style.opacity = String(o);
      dom.panel.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
    }
  };
}
