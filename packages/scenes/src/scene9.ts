import {
  Box3,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type LineBasicMaterial,
  type LineSegments,
} from 'three';
import { LIGHTING, lerpLighting, type VaultStage } from '@muqarnas/render';
import { fitCameraToBox, sampleCameraPath, type CameraKey } from './camera.js';
import { cascadeTiers, type RisingVaultRig } from './rig.js';
import { inkLines, inkOpacity, span } from './ink.js';

/**
 * SCENE 9 — THE RETURN. The close.
 *
 * The spec wrote this scene as one sentence: "The vault dissolves down
 * through its tiers, into the plan, into the module, into the point." So
 * the site's whole generative chain runs backwards, once, to say
 * goodnight. The viewer has seen the descent before — in scene 7 it was
 * an argument; here, under the ember (the lighting language's "state of
 * the return"), it is a farewell. The rings give themselves back
 * top-down, the flatness is the plan again, and then the light itself
 * goes: as the exposure dies the plaster sinks into the dark and the ink
 * — which needs no light — comes back through it. The plate dissolves
 * around one surviving stroke, the module; the module contracts to the
 * point it was struck from. The camera ends on the site's first frame,
 * holding a single point of ink where a building used to be.
 */

export interface Scene9Parts {
  readonly rig: RisingVaultRig;
  /** The plate drawing, returning as the light leaves. */
  readonly planLines: LineSegments;
}

export interface Scene9Objects {
  readonly group: Group;
  readonly strokeGroup: Group;
  readonly stroke: LineSegments;
  readonly point: Mesh;
}

export interface Scene9Dom {
  readonly captionA?: HTMLElement; // the ember hour
  readonly captionB?: HTMLElement; // into the plan
  readonly captionC?: HTMLElement; // into the module, into the point
}

/**
 * One measure of ink centred where the crown ring left its opening, and
 * the point it contracts into — a small SOLID dot, not a ring: a point
 * is filled.
 */
export function makeScene9Objects(): Scene9Objects {
  const group = new Group();
  const strokeGroup = new Group();
  const stroke = inkLines([-0.5, 0, 0.03, 0.5, 0, 0.03], 0.95);
  inkOpacity(stroke, 0);
  strokeGroup.add(stroke);
  const point = new Mesh(
    new CircleGeometry(0.13, 28),
    new MeshBasicMaterial({ color: 0xe8e2d5, transparent: true, opacity: 0 }),
  );
  point.position.z = 0.03;
  point.renderOrder = 2;
  point.visible = false;
  group.add(strokeGroup, point);
  return { group, strokeGroup, stroke, point };
}

/** The dissolution, exposed for tests: full at rest, gone by two thirds. */
export function returnDescent(p: number): number {
  return 1 - span(p, 0.18, 0.62);
}

const CAMERA_PATH: CameraKey[] = [
  { at: 0.0, pos: [0.5, -2.5, -16], target: [0, 0, 20] }, // scene 8's stance, kept
  { at: 0.3, pos: [26, -20, 17], target: [0, 0, 9] }, // stepping out for the last time
  { at: 0.68, pos: [0, -7, 58], target: [0, 0, 0] }, // the site's first frame
  { at: 1.0, pos: [0, -7, 58], target: [0, 0, 0] },
];

/** Scene 8 ends at the rake's returned hour; the ember takes over from it. */
const RAKE_150 = { ...LIGHTING.rake, sun: { ...LIGHTING.rake.sun, azimuthDeg: 150 } };

export function createScene9(
  parts: Scene9Parts,
  objects: Scene9Objects,
  stage: VaultStage,
  dom: Scene9Dom = {},
) {
  const pos = new Vector3();
  const tgt = new Vector3();
  parts.rig.geometry.computeBoundingBox();
  const frameBounds = parts.rig.geometry.boundingBox?.clone() ?? new Box3();

  return (p: number): void => {
    // down through the tiers
    parts.rig.update(cascadeTiers(returnDescent(p), parts.rig.maxTier));

    // the day lowers to ember — a hush, never darkness: the return stays
    // warm and lit all the way to the point
    const base = lerpLighting(RAKE_150, LIGHTING.ember, span(p, 0.02, 0.16));
    const dim = 1 - 0.14 * span(p, 0.55, 0.75);
    stage.applyLighting({ ...base, exposure: base.exposure * dim });

    // the ink needs no light: the plan comes back through the dark,
    // then dissolves around the one stroke that survives it
    const m = parts.planLines.material as LineBasicMaterial;
    m.opacity = 0.9 * span(p, 0.5, 0.66) * (1 - span(p, 0.74, 0.84));
    parts.planLines.visible = m.opacity > 0.01;

    // into the module, into the point: the stroke contracts and hands
    // itself to the dot that holds
    inkOpacity(objects.stroke, 0.95 * span(p, 0.72, 0.8) * (1 - span(p, 0.9, 0.96)));
    objects.strokeGroup.scale.x = Math.max(0.02, 1 - span(p, 0.84, 0.94));
    const pm = objects.point.material as MeshBasicMaterial;
    pm.opacity = 0.95 * span(p, 0.88, 0.96);
    objects.point.visible = pm.opacity > 0.004;

    // camera
    sampleCameraPath(CAMERA_PATH, p, pos, tgt);
    stage.camera.position.copy(pos);
    fitCameraToBox(stage.camera, tgt, frameBounds);
    stage.controls.target.copy(tgt);
    stage.controls.update();

    // captions
    if (dom.captionA) {
      dom.captionA.style.opacity = String(span(p, 0.04, 0.1) * (1 - span(p, 0.18, 0.24)));
    }
    if (dom.captionB) {
      dom.captionB.style.opacity = String(span(p, 0.5, 0.58) * (1 - span(p, 0.7, 0.76)));
    }
    if (dom.captionC) {
      dom.captionC.style.opacity = String(span(p, 0.86, 0.94));
    }
  };
}
