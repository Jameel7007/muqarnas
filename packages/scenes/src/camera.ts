import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Object3D,
  PerspectiveCamera,
  Vector3,
  type Material,
} from 'three';

/** A camera pose keyed to normalized scene progress. */
export interface CameraKey {
  readonly at: number;
  readonly pos: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

/** Shared edge clearance for bounds-aware shots. */
export const CAMERA_FRAME_PADDING = 1.08;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function equal3(a: readonly number[], b: readonly number[]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function tangent(
  keys: readonly CameraKey[],
  index: number,
  field: 'pos' | 'target',
  axis: number,
): number {
  if (index <= 0 || index >= keys.length - 1) return 0;
  const prev = keys[index - 1]!;
  const here = keys[index]!;
  const next = keys[index + 1]!;

  // Repeated poses are intentional holds. Keep their boundaries still so
  // dissolves and didactic pauses remain pixel-stable.
  if (equal3(prev[field], here[field]) || equal3(here[field], next[field])) return 0;

  const dt = next.at - prev.at;
  return dt > 0 ? (next[field][axis]! - prev[field][axis]!) / dt : 0;
}

function sampleField(
  keys: readonly CameraKey[],
  segment: number,
  p: number,
  field: 'pos' | 'target',
  out: Vector3,
): void {
  const a = keys[segment]!;
  const b = keys[segment + 1]!;
  if (equal3(a[field], b[field])) {
    out.set(a[field][0]!, a[field][1]!, a[field][2]!);
    return;
  }
  const dt = b.at - a.at;
  const t = dt > 0 ? clamp01((p - a.at) / dt) : 0;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const value = (axis: number) =>
    h00 * a[field][axis]! +
    h10 * dt * tangent(keys, segment, field, axis) +
    h01 * b[field][axis]! +
    h11 * dt * tangent(keys, segment + 1, field, axis);

  out.set(value(0), value(1), value(2));
}

/**
 * Sample an authored camera path with continuous velocity through its
 * internal keys. Endpoints and repeated hold poses remain exact.
 */
export function sampleCameraPath(
  keys: readonly CameraKey[],
  p: number,
  position: Vector3,
  target: Vector3,
): void {
  if (keys.length < 2) throw new Error('camera path needs at least two keys');
  let segment = 0;
  while (segment < keys.length - 2 && p > keys[segment + 1]!.at) segment++;
  sampleField(keys, segment, p, 'pos', position);
  sampleField(keys, segment, p, 'target', target);
}

const direction = new Vector3();
const right = new Vector3();
const up = new Vector3();
const corner = new Vector3();
const relative = new Vector3();
const childBounds = new Box3();

/**
 * A view from beneath is not a portrait. A muqarnas hangs over an opening,
 * and the camera under that opening is meant to be INSIDE the work, with
 * the cells overflowing the frame — the view the whole lighting language
 * exists for. Retreating until the entire vault sat in frame would turn
 * the piece's one immersive shot into a distant object shot, so a camera
 * below the bounds and within their footprint keeps its authored stance.
 * Exterior shots, including the overhead plan views, still fit. (World z
 * is up throughout this project; the stage sets camera.up to +z.)
 */
function isInteriorView(camera: PerspectiveCamera, bounds: Box3): boolean {
  const { x, y, z } = camera.position;
  return (
    z < bounds.min.z &&
    x >= bounds.min.x &&
    x <= bounds.max.x &&
    y >= bounds.min.y &&
    y <= bounds.max.y
  );
}

/**
 * Move the camera backward along its authored sightline just far enough to
 * keep an axis-aligned box inside the current perspective frustum. The
 * target and shot direction do not change, and already-safe shots — and
 * deliberate interior views — are left untouched.
 */
export function fitCameraToBox(
  camera: PerspectiveCamera,
  target: Vector3,
  bounds: Box3,
  padding = CAMERA_FRAME_PADDING,
): number {
  if (bounds.isEmpty()) return 0;
  if (isInteriorView(camera, bounds)) return 0;

  direction.copy(target).sub(camera.position);
  if (direction.lengthSq() < 1e-12) return 0;
  direction.normalize();
  right.copy(direction).cross(camera.up).normalize();
  if (right.lengthSq() < 1e-12) return 0;
  up.copy(right).cross(direction).normalize();

  const verticalHalfFov = (camera.fov * Math.PI) / 360;
  const tanVertical = Math.tan(verticalHalfFov);
  const tanHorizontal = tanVertical * camera.aspect;
  if (tanVertical <= 0 || tanHorizontal <= 0) return 0;

  let retreat = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        corner.set(x, y, z);
        relative.copy(corner).sub(camera.position);
        const depth = relative.dot(direction);
        const horizontal = Math.abs(relative.dot(right));
        const vertical = Math.abs(relative.dot(up));
        retreat = Math.max(
          retreat,
          (horizontal * padding) / tanHorizontal - depth,
          (vertical * padding) / tanVertical - depth,
          camera.near * 1.5 - depth,
        );
      }
    }
  }

  if (retreat <= 1e-9) return 0;
  camera.position.addScaledVector(direction, -retreat);
  return retreat;
}

/** Fit the current, possibly deformed, position attribute of a rig. */
export function fitCameraToGeometry(
  camera: PerspectiveCamera,
  target: Vector3,
  geometry: BufferGeometry,
  scratchBounds: Box3,
  padding = CAMERA_FRAME_PADDING,
): number {
  const positions = geometry.getAttribute('position');
  if (!positions) return 0;
  scratchBounds.setFromBufferAttribute(positions as BufferAttribute);
  return fitCameraToBox(camera, target, scratchBounds, padding);
}

function materialContributes(material: Material | Material[]): boolean {
  const materials = Array.isArray(material) ? material : [material];
  return materials.some((m) => m.visible && (!m.transparent || m.opacity > 0.004));
}

/**
 * Fit the actual visible child bounds of a composed object. Treating each
 * child separately avoids inventing empty AABB corners between separated
 * objects (for example scene I's descending dome and room).
 */
export function fitCameraToObject(
  camera: PerspectiveCamera,
  target: Vector3,
  root: Object3D,
  padding = CAMERA_FRAME_PADDING,
): number {
  let totalRetreat = 0;
  root.updateWorldMatrix(true, true);
  root.traverseVisible((object) => {
    const renderable = object as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    const geometry = renderable.geometry;
    if (!geometry || (renderable.material && !materialContributes(renderable.material))) return;
    if (geometry.drawRange.count === 0) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    childBounds.copy(geometry.boundingBox).applyMatrix4(object.matrixWorld);
    totalRetreat += fitCameraToBox(camera, target, childBounds, padding);
  });
  return totalRetreat;
}
