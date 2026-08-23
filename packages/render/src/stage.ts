import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * The stage: renderer, camera, and the lighting language.
 *
 * The default view of a muqarnas is from below and close — the camera
 * stands under the vault looking up, not orbiting a museum object. Light
 * follows the historical situation of a vault over a portal or iwan: it
 * does not fall from the sky, it enters low — reflected off the courtyard
 * (a warm, ground-up hemisphere) and raking in from the opening (a low
 * warm directional that climbs into the cells and hands the geometry its
 * shadows). Z is up throughout, in modules.
 */

export interface VaultStage {
  readonly renderer: THREE.WebGPURenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  setGeometry(geometry: THREE.BufferGeometry, material: THREE.Material): void;
  setView(preset: 'beneath' | 'profile'): void;
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

  // courtyard light: warm from below, dim cool sky above
  const hemi = new THREE.HemisphereLight(0x232833, 0xcdb48e, 1.1);
  hemi.position.set(0, 0, 1);
  scene.add(hemi);

  // the raking light from the opening, climbing into the cells
  const sun = new THREE.DirectionalLight(0xffe0b4, 2.4);
  sun.position.set(30, -42, 4);
  sun.target.position.set(0, 0, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 44;
  sun.shadow.camera.bottom = -20;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  // faint cool fill from the opposite quarter so shadows never go dead
  const fill = new THREE.DirectionalLight(0x8fa3bd, 0.28);
  fill.position.set(-26, 30, -8);
  fill.target.position.set(0, 0, 18);
  scene.add(fill);
  scene.add(fill.target);

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

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
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
    dispose() {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
