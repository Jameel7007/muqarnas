/**
 * @muqarnas/render — three/webgpu + TSL. Lighting, materials, camera.
 * Light is the subject: the lighting language locks here before any scene
 * work begins.
 */
export {
  vaultToGeometry,
  toDisplayGeometry,
  makeVaultMesh,
  withAoAttribute,
  withPaintAttribute,
} from './geometry.js';
export { bakeVertexAO, type AoOptions } from './ao.js';
export {
  BAKED_SCHEMA_VERSION,
  hashParams,
  encodeBakedReading,
  decodeBakedReading,
  type BakedReading,
} from './baked.js';
export { plasterMaterial, type PlasterOptions } from './plaster.js';
export { createVaultStage, type VaultStage } from './stage.js';
export { LIGHTING, lerpLighting, sunOffset, type LightingState } from './lighting.js';
