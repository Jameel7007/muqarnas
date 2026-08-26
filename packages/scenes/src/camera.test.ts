import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CAMERA_FRAME_PADDING, fitCameraToBox, sampleCameraPath, type CameraKey } from './camera.js';

const PATH: CameraKey[] = [
  { at: 0, pos: [0, 0, 0], target: [0, 1, 0] },
  { at: 0.35, pos: [4, 2, 1], target: [1, 2, 0] },
  { at: 0.7, pos: [7, -1, 3], target: [0, 4, 2] },
  { at: 1, pos: [9, 1, 4], target: [0, 5, 2] },
];

function sample(p: number) {
  const position = new Vector3();
  const target = new Vector3();
  sampleCameraPath(PATH, p, position, target);
  return { position, target };
}

describe('camera path sampling', () => {
  it('lands exactly on every authored pose', () => {
    for (const key of PATH) {
      const pose = sample(key.at);
      expect(pose.position.toArray()).toEqual([...key.pos]);
      expect(pose.target.toArray()).toEqual([...key.target]);
    }
  });

  it('keeps velocity continuous through internal keys', () => {
    const epsilon = 1e-5;
    for (const key of PATH.slice(1, -1)) {
      const left = sample(key.at - epsilon);
      const centre = sample(key.at);
      const right = sample(key.at + epsilon);
      for (const field of ['position', 'target'] as const) {
        const leftVelocity = centre[field].clone().sub(left[field]).divideScalar(epsilon);
        const rightVelocity = right[field].clone().sub(centre[field]).divideScalar(epsilon);
        expect(leftVelocity.distanceTo(rightVelocity)).toBeLessThan(0.01);
      }
    }
  });

  it('keeps repeated dissolve poses completely still', () => {
    const held: CameraKey[] = [
      { at: 0, pos: [1, 2, 3], target: [0, 0, 0] },
      { at: 0.08, pos: [1, 2, 3], target: [0, 0, 0] },
      { at: 1, pos: [8, 4, 2], target: [0, 1, 0] },
    ];
    for (let i = 0; i <= 8; i++) {
      const position = new Vector3();
      const target = new Vector3();
      sampleCameraPath(held, i / 100, position, target);
      expect(position.toArray()).toEqual([1, 2, 3]);
      expect(target.toArray()).toEqual([0, 0, 0]);
    }
  });
});

describe('responsive camera framing', () => {
  it.each([
    [16 / 9, 44],
    [4 / 3, 54],
    [390 / 844, 78],
    [844 / 390, 44],
  ])('keeps every bound corner inside the frustum at aspect %s', (aspect, fov) => {
    const camera = new PerspectiveCamera(fov, aspect, 0.1, 500);
    camera.up.set(0, 0, 1);
    camera.position.set(10, -13, 5);
    const target = new Vector3(0, 0, 8);
    const bounds = new Box3(new Vector3(-12, -12, 0), new Vector3(12, 12, 24));

    fitCameraToBox(camera, target, bounds);

    const forward = target.clone().sub(camera.position).normalize();
    const right = forward.clone().cross(camera.up).normalize();
    const up = right.clone().cross(forward).normalize();
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const tanH = tanV * camera.aspect;
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const relative = new Vector3(x, y, z).sub(camera.position);
          const depth = relative.dot(forward);
          expect((Math.abs(relative.dot(right)) * CAMERA_FRAME_PADDING) / depth).toBeLessThanOrEqual(
            tanH + 1e-9,
          );
          expect((Math.abs(relative.dot(up)) * CAMERA_FRAME_PADDING) / depth).toBeLessThanOrEqual(
            tanV + 1e-9,
          );
        }
      }
    }
  });

  it('leaves a view from beneath the opening immersive', () => {
    // the vault hangs over an opening; the camera under its footprint is
    // inside the work, and the cells are meant to overflow the frame
    const camera = new PerspectiveCamera(44, 16 / 9, 0.1, 500);
    camera.up.set(0, 0, 1);
    camera.position.set(0.5, -2.5, -16);
    const before = camera.position.clone();
    const bounds = new Box3(new Vector3(-11.9, -11.9, 0), new Vector3(11.9, 11.9, 34));

    expect(fitCameraToBox(camera, new Vector3(0, 0, 20), bounds)).toBe(0);
    expect(camera.position).toEqual(before);
  });

  it('still fits the overhead plan view, which is an exterior shot', () => {
    const camera = new PerspectiveCamera(44, 16 / 9, 0.1, 500);
    camera.up.set(0, 0, 1);
    camera.position.set(0, -6, 40);
    const bounds = new Box3(new Vector3(-11.9, -11.9, 0), new Vector3(11.9, 11.9, 34));

    // directly above the footprint, but outside the object: the whole
    // drawing must be in frame
    expect(fitCameraToBox(camera, new Vector3(0, 0, 0), bounds)).toBeGreaterThan(0);
  });

  it('does not move an authored camera that already has safe clearance', () => {
    const camera = new PerspectiveCamera(44, 16 / 9, 0.1, 500);
    camera.up.set(0, 0, 1);
    camera.position.set(0, -80, 5);
    const before = camera.position.clone();
    const target = new Vector3(0, 0, 5);
    const retreat = fitCameraToBox(
      camera,
      target,
      new Box3(new Vector3(-2, -2, 2), new Vector3(2, 2, 8)),
    );
    expect(retreat).toBe(0);
    expect(camera.position).toEqual(before);
  });
});
