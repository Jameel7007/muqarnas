import { DoubleSide } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  abs,
  attribute,
  color,
  float,
  max,
  mix,
  mx_noise_float,
  positionWorld,
  pow,
  smoothstep,
} from 'three/tsl';

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
  /** painted ornament on the facets: the star-and-cross, in oxide ochre */
  readonly ochre?: number;
  /** how much of the facet field the stencil claims, 0..1 */
  readonly ornamentStrength?: number;
  /** size of the fitted medallion relative to its facet, ~1 */
  readonly ornamentScale?: number;
  /** gilt at each bowl's apex — albedo only, never emissive */
  readonly gilt?: number;
  readonly giltStrength?: number;
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
  const cavity = pow(ao, float(opts.cavityStrength ?? 1.12));
  // micro-life: three scales of noise drift the albedo a few percent and
  // the roughness a little — hand-floated plaster, not injection moulding.
  // The grain octave exists for the close-ups, where a cell's backside
  // fills the frame and a two-scale surface reads as bare CG.
  const broad = mx_noise_float(positionWorld.mul(0.14));
  const fine = mx_noise_float(positionWorld.mul(1.3));
  const grain = mx_noise_float(positionWorld.mul(5.6));
  const tone = broad.mul(0.045).add(fine.mul(0.03)).add(grain.mul(0.025)).add(1);
  // ivory faience: near-white warm ceramic, its depths shading rather
  // than sinking to clay — the ornament and the glazes carry the colour
  const plasterBare = mix(color(opts.cavity ?? 0x94826a), color(opts.base ?? 0xf1e9d7), cavity);

  // the painted medallion: one whole eight-pointed star fitted to each
  // facet field — the union of a square and its 45° turn, the same two
  // seeds the whole plan is built from, composed to the panel the way a
  // painter would, never cropped by its edge. orn.xy are the field's own
  // centred coordinates, baked from the lift.
  const orn = attribute('orn', 'vec3');
  const K = float(opts.ornamentScale ?? 1);
  const cx = orn.x;
  const cy = orn.y;
  const e = float(0.025);
  const sq = max(abs(cx), abs(cy));
  const di = abs(cx).add(abs(cy));
  const star = max(
    smoothstep(K.mul(0.4).add(e), K.mul(0.4).sub(e), sq),
    smoothstep(K.mul(0.56).add(e), K.mul(0.56).sub(e), di),
  );
  const stencil = star.mul(orn.z).mul(float(opts.ornamentStrength ?? 0.62));
  const plasterCol = mix(plasterBare, mix(color(0x6b3020), color(opts.ochre ?? 0xb35a30), cavity), stencil);

  const turquoise = mix(color(opts.glazeCavity ?? 0x1d6b74), color(opts.glaze ?? 0x35bcb0), cavity);
  const cobalt = mix(color(opts.cobaltCavity ?? 0x1c2c77), color(opts.cobalt ?? 0x3560c4), cavity);
  const painted = paint.clamp(0, 1);
  const hue = paint.sub(1).clamp(0, 1);
  // gilt: each bowl warms toward gold at its apex — colour only, the
  // light does the shining
  const gilt = attribute('glow', 'float').mul(float(opts.giltStrength ?? 0.65));
  const glazeCol = mix(mix(turquoise, cobalt, hue), mix(color(0x7a5a1e), color(opts.gilt ?? 0xd9a441), cavity), gilt);
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
