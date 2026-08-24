import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LIGHTING, sunOffset, type LightingState } from './lighting.js';

/**
 * The stage: renderer, camera, and the mount point for the lighting
 * language (see lighting.ts — the language itself is locked there).
 *
 * The default view of a muqarnas is from below and close — the camera
 * stands under the vault looking up, not orbiting a museum object.
 * Z is up throughout, in modules.
 */

export interface VaultStage {
  readonly renderer: THREE.WebGPURenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  setGeometry(geometry: THREE.BufferGeometry, material: THREE.Material): void;
  setView(preset: 'beneath' | 'profile'): void;
  /** Apply a state of the lighting language (or an interpolation of two). */
  applyLighting(state: LightingState): void;
  /**
   * Copy the next rendered frame into `target` (same-task with the render,
   * which is the only moment a WebGPU canvas can be read). `onDone` fires
   * once the pixels are in place.
   */
  captureFrame(target: HTMLCanvasElement, onDone?: () => void): void;
  /** 'webgpu' or 'webgl2' after init */
  readonly backend: string;
  dispose(): void;
}

export async function createVaultStage(container: HTMLElement): Promise<VaultStage> {
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  await renderer.init();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14120e);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 500);
  camera.up.set(0, 0, 1);

  // the three instruments of the language: courtyard hemisphere, raking
  // key, faint opposite fill — parameters come only from LightingState
  const hemi = new THREE.HemisphereLight();
  hemi.position.set(0, 0, 1);
  scene.add(hemi);

  const LIGHT_TARGET = new THREE.Vector3(0, 0, 18);
  const SUN_DISTANCE = 85;
  const sun = new THREE.DirectionalLight();
  sun.target.position.copy(LIGHT_TARGET);
  sun.castShadow = true;
  // close-up scenes live a hand's width from the plaster: a fine map over a
  // frustum fitted to the built field, blurred enough that terminators read
  // as penumbra rather than texel staircases
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 220;
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  // wide penumbra: at glancing angles a tight shadow edge staircases at
  // texel scale, and a stepped terminator crossing a painted figure reads
  // as broken ornament
  sun.shadow.radius = 10;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight();
  fill.target.position.copy(LIGHT_TARGET);
  scene.add(fill);
  scene.add(fill.target);

  const applyLighting = (state: LightingState) => {
    renderer.toneMappingExposure = state.exposure;
    hemi.color.set(state.hemisphere.sky);
    hemi.groundColor.set(state.hemisphere.ground);
    hemi.intensity = state.hemisphere.intensity;
    sun.color.set(state.sun.color);
    sun.intensity = state.sun.intensity;
    const [ox, oy, oz] = sunOffset(state.sun);
    sun.position
      .copy(LIGHT_TARGET)
      .add(new THREE.Vector3(ox * SUN_DISTANCE, oy * SUN_DISTANCE, oz * SUN_DISTANCE));
    fill.color.set(state.fill.color);
    fill.intensity = state.fill.intensity;
    const [fx, fy, fz] = sunOffset({
      ...state.sun,
      azimuthDeg: state.sun.azimuthDeg + 180,
      elevationDeg: -state.sun.elevationDeg - 20,
    });
    fill.position
      .copy(LIGHT_TARGET)
      .add(new THREE.Vector3(fx * SUN_DISTANCE, fy * SUN_DISTANCE, fz * SUN_DISTANCE));
  };
  applyLighting(LIGHTING.rake);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const group = new THREE.Group();
  scene.add(group);

  const setView = (preset: 'beneath' | 'profile') => {
    if (preset === 'beneath') {
      camera.position.set(4, -11, -17);
      controls.target.set(0, 0, 20);
    } else {
      camera.position.set(42, -44, 20);
      controls.target.set(0, 0, 14);
    }
    controls.update();
  };
  setView('beneath');

  // scenes are framed for a wide stage: on narrower windows, widen the
  // vertical fov so the HORIZONTAL field stays what the framing assumed —
  // compositions shrink instead of falling off the sides
  const BASE_FOV = 44;
  const BASE_ASPECT = 16 / 9;
  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    if (camera.aspect >= BASE_ASPECT) {
      camera.fov = BASE_FOV;
    } else {
      const wide =
        (2 * Math.atan(Math.tan((BASE_FOV * Math.PI) / 360) * (BASE_ASPECT / camera.aspect)) * 180) /
        Math.PI;
      camera.fov = Math.min(wide, 78);
    }
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const pendingCaptures: Array<{ target: HTMLCanvasElement; onDone?: () => void }> = [];
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
    while (pendingCaptures.length) {
      const { target, onDone } = pendingCaptures.shift()!;
      try {
        target.width = renderer.domElement.width;
        target.height = renderer.domElement.height;
        target.getContext('2d')?.drawImage(renderer.domElement, 0, 0);
      } catch {
        const ctx = target.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#14120e';
          ctx.fillRect(0, 0, target.width, target.height);
        }
      }
      onDone?.();
    }
  });

  return {
    renderer,
    scene,
    camera,
    controls,
    get backend() {
      const b = (renderer as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
      return b?.isWebGPUBackend ? 'webgpu' : 'webgl2';
    },
    setGeometry(geometry, material) {
      for (const child of [...group.children]) {
        group.remove(child);
        (child as THREE.Mesh).geometry?.dispose();
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    },
    setView,
    applyLighting,
    captureFrame(target, onDone) {
      pendingCaptures.push({ target, onDone });
    },
    dispose() {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
