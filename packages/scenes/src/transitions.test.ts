import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createScene7 } from './scene7.js';
import { createScene8 } from './scene8.js';
import { createCoda } from './coda.js';
import type { RisingVaultRig } from './rig.js';

/**
 * The stillness contract of the cross-dissolves: the melt holds the
 * previous scene's last frame over the incoming scene, so any camera
 * motion during the fade band superimposes two stances — a smeared
 * double-exposure that reads as warped geometry. Every scene that opens
 * with a travel must therefore hold its opening stance, exactly, until
 * its melt band is over. The bands here are each scene's fade extent in
 * track progress (0.3 viewport heights over the track's height), with
 * margin.
 */

const makeStage = () => ({
  camera: { position: new Vector3() },
  controls: {
    target: new Vector3(),
    update() {},
    addEventListener() {},
    enableZoom: true,
    enablePan: true,
    minPolarAngle: 0,
    maxPolarAngle: Math.PI,
  },
  applyLighting() {},
});

const rig = { maxTier: 17, update() {} } as unknown as RisingVaultRig;

function maxDrift(update: (p: number) => void, stage: ReturnType<typeof makeStage>, band: number) {
  update(0);
  const p0 = stage.camera.position.clone();
  const t0 = stage.controls.target.clone();
  let drift = 0;
  for (let i = 0; i <= 20; i++) {
    update((band * i) / 20);
    drift = Math.max(drift, stage.camera.position.distanceTo(p0), stage.controls.target.distanceTo(t0));
  }
  return drift;
}

describe('dissolve stillness', () => {
  it('scene 7 holds scene 6 beneath-stance through the 6→7 melt', () => {
    const stage = makeStage();
    const update = createScene7(
      { rigA: rig, rigB: rig, meshA: { visible: true } as never, meshB: { visible: true } as never },
      stage as never,
    );
    expect(maxDrift(update, stage, 0.045)).toBe(0);
  });

  it('scene 8 holds scene 7 final stance through the 7→8 melt', () => {
    const stage = makeStage();
    const update = createScene8({ rig }, stage as never);
    expect(maxDrift(update, stage, 0.026)).toBe(0);
  });

  it("the coda holds the site's first frame through the 9→coda melt", () => {
    const stage = makeStage();
    const update = createCoda({ rig }, stage as never);
    expect(maxDrift(update, stage, 0.062)).toBe(0);
  });
});
