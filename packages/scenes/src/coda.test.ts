import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createCoda } from './coda.js';
import type { RisingVaultRig } from './rig.js';

/**
 * Free-look is no longer a scroll scene. Opening it must present a fully
 * framed vault and explicitly transfer touch ownership from the page to
 * OrbitControls; closing it must give that ownership back.
 */

const SPHERE = { center: new Vector3(0, 0, 11), radius: 26 };

const makeStage = () => {
  let start = () => {};
  const surface = {
    style: { touchAction: 'pan-y' },
    addEventListener() {},
  } as unknown as HTMLElement;
  const stage = {
    camera: { position: new Vector3(), fov: 44, aspect: 16 / 9 },
    controls: {
      target: new Vector3(),
      domElement: surface,
      enabled: false,
      update() {},
      addEventListener(type?: string, listener?: () => void) {
        if (type === 'start' && listener) start = listener;
      },
      enableZoom: true,
      enablePan: true,
      minPolarAngle: 0,
      maxPolarAngle: Math.PI,
      minDistance: 0,
      maxDistance: Infinity,
    },
    applyLighting() {},
  };
  return { stage, surface, start: () => start() };
};

const rig = {
  maxTier: 17,
  update() {},
  geometry: { boundingSphere: SPHERE },
} as unknown as RisingVaultRig;

describe('standalone free-look coda', () => {
  it('opens on a whole-vault view that fits in both frustum axes', () => {
    const { stage } = makeStage();
    const coda = createCoda({ rig }, stage as never);
    coda.open();

    const vertical = (stage.camera.fov * Math.PI) / 360;
    const horizontal = Math.atan(Math.tan(vertical) * stage.camera.aspect);
    const halfAngle = Math.min(vertical, horizontal);
    const distance = stage.camera.position.distanceTo(SPHERE.center);
    expect(Math.asin(Math.min(1, SPHERE.radius / distance))).toBeLessThanOrEqual(halfAngle);
    expect(stage.controls.target.distanceTo(SPHERE.center)).toBeLessThan(1e-9);
  });

  it('transfers touch ownership only while the viewer is open', () => {
    const { stage, surface } = makeStage();
    const hint = { style: { opacity: '' } } as unknown as HTMLElement;
    const panel = { style: { opacity: '', pointerEvents: '' } } as unknown as HTMLElement;
    const coda = createCoda({ rig }, stage as never, { hint, panel });

    coda.open();
    expect(stage.controls.enabled).toBe(true);
    expect(surface.style.touchAction).toBe('none');
    expect(hint.style.opacity).toBe('1');
    expect(panel.style.pointerEvents).toBe('auto');

    coda.close();
    expect(stage.controls.enabled).toBe(false);
    expect(surface.style.touchAction).toBe('pan-y');
    expect(hint.style.opacity).toBe('0');
    expect(panel.style.pointerEvents).toBe('none');
  });

  it('refits an open viewer after rotation without changing its viewing direction', () => {
    const { stage } = makeStage();
    const coda = createCoda({ rig }, stage as never);
    coda.open();
    const before = stage.camera.position.clone().sub(SPHERE.center).normalize();

    stage.camera.aspect = 390 / 844;
    stage.camera.fov = 78;
    coda.resize();

    const after = stage.camera.position.clone().sub(SPHERE.center).normalize();
    const vertical = (stage.camera.fov * Math.PI) / 360;
    const horizontal = Math.atan(Math.tan(vertical) * stage.camera.aspect);
    const distance = stage.camera.position.distanceTo(SPHERE.center);
    expect(after.distanceTo(before)).toBeLessThan(1e-9);
    expect(Math.asin(Math.min(1, SPHERE.radius / distance))).toBeLessThanOrEqual(
      Math.min(vertical, horizontal),
    );
  });

  it('dismisses the gesture hint after the viewer is taken in hand', () => {
    const { stage, start } = makeStage();
    const hint = { style: { opacity: '' } } as unknown as HTMLElement;
    const coda = createCoda({ rig }, stage as never, { hint });

    coda.open();
    start();
    expect(hint.style.opacity).toBe('0');
  });
});
