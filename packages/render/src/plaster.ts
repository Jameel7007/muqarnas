import { DoubleSide } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, color, float, mix, mx_noise_float, positionWorld, pow } from 'three/tsl';

/**
 * The material language: plaster, not metal. A rough dielectric — no
 * metalness, no emissive gold, no bloom — whose whole quality is diffuse
 * light in shallow shadow. The baked per-vertex occlusion enters twice:
 * as the standard ambient-occlusion term, and as a gentle cavity tint in
 * the albedo (carved plaster collects shadow-toned dust in its depths;
 * this also keeps the cells readable where direct light misses them).
 *
 * v2 — THE PAINTED VAULT. Takht-i Sulaymān's cells wore fired colour, and
 * the per-vertex `paint` attribute (1 on the curved canopy, 0 on facets,
 * bands, and walls) carries a glaze wash: turquoise sinking to a deep
 * cobalt-teal in its cavities, and glossier than the plaster around it,
 * so the low key answers off the bowls with sheen. Still a dielectric —
 * no metalness, no emissive; the glaze is colour and roughness only.
 */

export interface PlasterOptions {
  /** open-surface plaster colour */
  readonly base?: number;
  /** colour the cavities sink toward */
  readonly cavity?: number;
  /** exponent on the baked ao for the cavity tint */
  readonly cavityStrength?: number;
  readonly roughness?: number;
  /** fired colour of the painted canopy (paint = 1) */
  readonly glaze?: number;
  /** colour the glaze sinks toward in its depths */
  readonly glazeCavity?: number;
  /** the second blue of the tilework (paint = 2) */
  readonly cobalt?: number;
  readonly cobaltCavity?: number;
  /** how much of the canopy the wash claims, 0..1 */
  readonly glazeStrength?: number;
  /** the glaze's gloss — lower than plaster, never metal */
  readonly glazeRoughness?: number;
}

export function plasterMaterial(opts: PlasterOptions = {}): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  material.metalness = 0;
  material.side = DoubleSide; // the profile view sees the extrados too

  const ao = attribute('ao', 'float');
  const paint = attribute('paint', 'float');
  const cavity = pow(ao, float(opts.cavityStrength ?? 1.35));
  // micro-life: three scales of noise drift the albedo a few percent and
  // the roughness a little — hand-floated plaster, not injection moulding.
  // The grain octave exists for the close-ups, where a cell's backside
  // fills the frame and a two-scale surface reads as bare CG.
  const broad = mx_noise_float(positionWorld.mul(0.14));
  const fine = mx_noise_float(positionWorld.mul(1.3));
  const grain = mx_noise_float(positionWorld.mul(5.6));
  const tone = broad.mul(0.045).add(fine.mul(0.03)).add(grain.mul(0.025)).add(1);
  const plasterCol = mix(color(opts.cavity ?? 0x5d4c3a), color(opts.base ?? 0xe7dbc2), cavity);
  const turquoise = mix(color(opts.glazeCavity ?? 0x14565e), color(opts.glaze ?? 0x31b0a5), cavity);
  const cobalt = mix(color(opts.cobaltCavity ?? 0x131e55), color(opts.cobalt ?? 0x2e56b8), cavity);
  const painted = paint.clamp(0, 1);
  const hue = paint.sub(1).clamp(0, 1);
  const glazeCol = mix(turquoise, cobalt, hue);
  const wash = painted.mul(float(opts.glazeStrength ?? 0.75)).mul(broad.mul(0.12).add(1));
  material.colorNode = mix(plasterCol, glazeCol, wash).mul(tone);
  material.roughnessNode = mix(
    float(opts.roughness ?? 0.92).add(broad.mul(0.05)).add(grain.mul(0.03)),
    float(opts.glazeRoughness ?? 0.42).add(grain.mul(0.05)),
    painted,
  );
  material.aoNode = ao;
  return material;
}
