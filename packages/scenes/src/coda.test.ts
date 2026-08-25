import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createCoda } from './coda.js';
import type { RisingVaultRig } from './rig.js';

/**
 * The coda's framing rule: until the viewer takes hold, the orbit rides
 * at the distance where the building's bounding sphere fits the frustum
 * in BOTH axes — so no rotation of the untouched turn can crop the
 * vault. (The old fixed radius of 48 sat inside the vault's own width;
 * the first drag cut it off at the frame.)
 */

const SPHERE = { center: new Vector3(0, 0, 11), radius: 26 };

const makeStage = () => ({
  camera: { position: new Vector3(), fov: 44, aspect: 16 / 9 },
  controls: {
    target: new Vector3(),
    update() {},
    addEventListener() {},
    enableZoom: true,
    enablePan: true,
    minPolarAngle: 0,
    maxPolarAngle: Math.PI,
    minDistance: 0,
    maxDistance: Infinity,
  },
  applyLighting() {},
});

const rig = {
  maxTier: 17,
  update() {},
  geometry: { boundingSphere: SPHERE },
} as unknown as RisingVaultRig;

describe('coda framing', () => {
  it('the untouched orbit keeps the whole building inside the frustum', () => {
    const stage = makeStage();
    const update = createCoda({ rig }, stage as never);
    const v = (stage.camera.fov * Math.PI) / 360;
    const h = Math.atan(Math.tan(v) * stage.camera.aspect);
    const halfAngle = Math.min(v, h);
    // after the handover glide, at every point of the turn
    for (let i = 0; i <= 20; i++) {
      const p = 0.2 + 0.8 * (i / 20);
      update(p);
      const d = stage.camera.position.distanceTo(SPHERE.center);
      expect(Math.asin(Math.min(1, SPHERE.radius / d))).toBeLessThanOrEqual(halfAngle);
      // and the camera looks at the sphere's centre, not past it
      expect(stage.controls.target.distanceTo(SPHERE.center)).toBeLessThan(1e-9);
    }
  });
});
