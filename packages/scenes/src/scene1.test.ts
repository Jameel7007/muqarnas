import { MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createScene1, makeScene1Objects } from './scene1.js';

const makeStage = () => {
  const camera = new PerspectiveCamera(44, 16 / 9, 0.1, 500);
  camera.up.set(0, 0, 1);
  return {
    camera,
    controls: {
      target: new Vector3(),
      update() {},
    },
    applyLighting() {},
  };
};

describe('scene 1 camera framing', () => {
  it('does not snap backward when the separated dome first appears', () => {
    const objects = makeScene1Objects(new MeshBasicMaterial(), { half: 14 });
    const stage = makeStage();
    const update = createScene1(objects, stage as never);

    update(0.4799);
    const before = stage.camera.position.clone();
    update(0.4801);

    expect(objects.dome.visible).toBe(true);
    expect(stage.camera.position.distanceTo(before)).toBeLessThan(0.1);
  });
});
