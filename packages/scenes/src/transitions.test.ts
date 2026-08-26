import { describe, expect, it } from 'vitest';
import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Vector3,
} from 'three';
import { createScene6 } from './scene6.js';
import { createScene7 } from './scene7.js';
import { createScene8 } from './scene8.js';
import { createScene5 } from './scene5.js';
import { createScene9, makeScene9Objects } from './scene9.js';
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

const makeStage = (aspect = 16 / 9) => {
  const camera = new PerspectiveCamera(44, aspect, 0.1, 500);
  camera.up.set(0, 0, 1);
  return {
    camera,
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
  };
};

const geometry = new BufferGeometry();
geometry.setAttribute(
  'position',
  new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 2, -1, 1, 2], 3),
);
const rig = { maxTier: 17, update() {}, geometry } as unknown as RisingVaultRig;

function framingGeometry(extent = 30): BufferGeometry {
  const result = new BufferGeometry();
  result.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        -extent, -extent, 0,
        extent, -extent, 0,
        extent, extent, extent,
        -extent, extent, extent,
      ],
      3,
    ),
  );
  return result;
}

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

function expectSamePose(a: ReturnType<typeof makeStage>, b: ReturnType<typeof makeStage>) {
  expect(a.camera.position.distanceTo(b.camera.position)).toBeLessThan(1e-9);
  expect(a.controls.target.distanceTo(b.controls.target)).toBeLessThan(1e-9);
}

describe('dissolve stillness', () => {
  it('scene 5 holds scene 4 drawing-view through the 4→5 melt', () => {
    const stage = makeStage();
    const update = createScene5(rig, stage as never);
    expect(maxDrift(update, stage, 0.055)).toBe(0);
  });

  it('scene 8 holds scene 7 final stance through the 7→8 melt', () => {
    const stage = makeStage();
    const update = createScene8({ rig }, stage as never);
    expect(maxDrift(update, stage, 0.026)).toBe(0);
  });

});

describe('continuous scene handoffs', () => {
  it('scene 7 leaves the matching scene 6 pose without an added hold', () => {
    const stage = makeStage();
    const update = createScene7(
      { rigA: rig, rigB: rig, meshA: { visible: true } as never, meshB: { visible: false } as never },
      stage as never,
    );
    update(0);
    const opening = stage.camera.position.clone();
    update(0.01);
    expect(stage.camera.position.distanceTo(opening)).toBeGreaterThan(0);
  });

  it('hands the camera from scene 5 through scene 9 without a pose jump', () => {
    const fiveStage = makeStage();
    createScene5(rig, fiveStage as never)(1);
    const sixStart = makeStage();
    createScene6({ rig, crownZ: 2 }, sixStart as never)(0);
    expectSamePose(fiveStage, sixStart);

    const sixEnd = makeStage();
    createScene6({ rig, crownZ: 2 }, sixEnd as never)(1);
    const sevenStart = makeStage();
    createScene7(
      { rigA: rig, rigB: rig, meshA: { visible: true } as never, meshB: { visible: false } as never },
      sevenStart as never,
    )(0);
    expectSamePose(sixEnd, sevenStart);

    const sevenEnd = makeStage();
    createScene7(
      { rigA: rig, rigB: rig, meshA: { visible: true } as never, meshB: { visible: false } as never },
      sevenEnd as never,
    )(1);
    const eightStart = makeStage();
    createScene8({ rig }, eightStart as never)(0);
    expectSamePose(sevenEnd, eightStart);

    const eightEnd = makeStage();
    createScene8({ rig }, eightEnd as never)(1);
    const nineStart = makeStage();
    const planLines = new LineSegments(
      new BufferGeometry(),
      new LineBasicMaterial({ transparent: true }),
    );
    createScene9({ rig, planLines }, makeScene9Objects(), nineStart as never)(0);
    expectSamePose(eightEnd, nineStart);
  });

  it('keeps the late VI → early VII move above the plan and free of fast turns', () => {
    const stage = makeStage();
    const scene6 = createScene6({ rig, crownZ: 2 }, stage as never);
    const scene7 = createScene7(
      { rigA: rig, rigB: rig, meshA: { visible: true } as never, meshB: { visible: false } as never },
      stage as never,
    );
    let previousAzimuth: number | undefined;
    const checkPose = () => {
      expect(stage.camera.position.z).toBeGreaterThan(0);
      const azimuth = Math.atan2(stage.camera.position.y, stage.camera.position.x);
      if (previousAzimuth !== undefined) {
        const turn = Math.atan2(
          Math.sin(azimuth - previousAzimuth),
          Math.cos(azimuth - previousAzimuth),
        );
        expect(Math.abs(turn)).toBeLessThan(0.12);
      }
      previousAzimuth = azimuth;
    };

    for (let i = 0; i <= 34; i++) {
      scene6(0.66 + i / 100);
      checkPose();
    }
    for (let i = 0; i <= 50; i++) {
      scene7(i / 100);
      checkPose();
    }
  });
});

describe('stable construction framing', () => {
  it('does not reframe as Scene VII geometry collapses tier by tier', () => {
    const collapsingGeometry = framingGeometry();
    const collapsingRig = {
      maxTier: 17,
      geometry: collapsingGeometry,
      update() {
        const positions = collapsingGeometry.getAttribute('position') as Float32BufferAttribute;
        for (let i = 0; i < positions.count; i++) positions.setXYZ(i, 0, 0, 0);
        positions.needsUpdate = true;
      },
    } as unknown as RisingVaultRig;
    const completeRig = {
      maxTier: 17,
      geometry: framingGeometry(),
      update() {},
    } as unknown as RisingVaultRig;
    const emptyRig = {
      maxTier: 17,
      geometry: new BufferGeometry(),
      update() {},
    } as unknown as RisingVaultRig;

    const collapsingStage = makeStage(1 / 2);
    createScene7(
      {
        rigA: collapsingRig,
        rigB: emptyRig,
        meshA: { visible: true } as never,
        meshB: { visible: false } as never,
      },
      collapsingStage as never,
    )(0.4);

    const completeStage = makeStage(1 / 2);
    createScene7(
      {
        rigA: completeRig,
        rigB: emptyRig,
        meshA: { visible: true } as never,
        meshB: { visible: false } as never,
      },
      completeStage as never,
    )(0.4);

    expectSamePose(collapsingStage, completeStage);
  });
});
