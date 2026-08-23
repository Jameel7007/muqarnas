import { DoubleSide } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, color, float, mix, pow } from 'three/tsl';

/**
 * The material language: plaster, not metal. A rough dielectric — no
 * metalness, no emissive gold, no bloom — whose whole quality is diffuse
 * light in shallow shadow. The baked per-vertex occlusion enters twice:
 * as the standard ambient-occlusion term, and as a gentle cavity tint in
 * the albedo (carved plaster collects shadow-toned dust in its depths;
 * this also keeps the cells readable where direct light misses them).
 */

export interface PlasterOptions {
  /** open-surface plaster colour */
  readonly base?: number;
  /** colour the cavities sink toward */
  readonly cavity?: number;
  /** exponent on the baked ao for the cavity tint */
  readonly cavityStrength?: number;
  readonly roughness?: number;
}

export function plasterMaterial(opts: PlasterOptions = {}): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  material.metalness = 0;
  material.roughness = opts.roughness ?? 0.93;
  material.side = DoubleSide; // the profile view sees the extrados too

  const ao = attribute('ao', 'float');
  const cavity = pow(ao, float(opts.cavityStrength ?? 1.35));
  material.colorNode = mix(color(opts.cavity ?? 0x5a4f42), color(opts.base ?? 0xe4dccb), cavity);
  material.aoNode = ao;
  return material;
}
