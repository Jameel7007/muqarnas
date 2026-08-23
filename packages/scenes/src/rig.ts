import { BufferAttribute, type BufferGeometry } from 'three';
import type { LiftedTriangle } from '@muqarnas/lift';

/**
 * The rising vault — the machinery of scenes 5 and 6.
 *
 * At height-scale zero, the vault's roofs ARE the plan: the projection
 * identity, made visible. Each triangle carries its tier and an azimuthal
 * delay; driving per-tier progress unfurls the vault tile by tile in a
 * sweep around the axis, and from above the drawing never changes — the
 * plan holds while the building appears.
 *
 * Vertical scaling is exact on positions; normals transform analytically
 * (inverse-transpose of diag(1,1,s)): vertical faces stay vertical, roofs
 * flatten toward +z, creases survive. The baked occlusion eases in with
 * the rise — flat tiles are open to the sky, cells earn their shadow.
 */

export interface RigOptions {
  /** fraction of a tier's timeline each tile's own rise occupies */
  readonly window?: number;
  /** azimuth (radians) where the sweep begins */
  readonly sweepStart?: number;
}

const smooth = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
};

export class RisingVaultRig {
  readonly geometry: BufferGeometry;
  private readonly finalPos: Float32Array;
  private readonly finalNormal: Float32Array;
  private readonly finalAo: Float32Array;
  private readonly tierOf: Int32Array; // per corner
  private readonly delayOf: Float32Array; // per corner, 0..1
  private readonly window: number;
  readonly maxTier: number;
  private readonly lastProgress = new Map<number, number>();

  constructor(displayGeometry: BufferGeometry, tris: readonly LiftedTriangle[], opts: RigOptions = {}) {
    this.geometry = displayGeometry;
    this.window = opts.window ?? 0.4;
    const sweepStart = opts.sweepStart ?? Math.PI / 4;

    const pos = displayGeometry.getAttribute('position');
    const nrm = displayGeometry.getAttribute('normal');
    const ao = displayGeometry.getAttribute('ao');
    const count = pos.count;
    if (count !== tris.length * 3) {
      throw new Error(`rig: display geometry (${count} corners) does not match ${tris.length} triangles`);
    }
    this.finalPos = new Float32Array(pos.array as Float32Array);
    this.finalNormal = new Float32Array(nrm.array as Float32Array);
    this.finalAo = new Float32Array(ao.array as Float32Array);
    this.tierOf = new Int32Array(count);
    this.delayOf = new Float32Array(count);

    let maxTier = 1;
    for (let t = 0; t < tris.length; t++) {
      const tier = tris[t]!.tier ?? 1;
      maxTier = Math.max(maxTier, tier);
      // azimuthal delay from the triangle centroid
      const cx =
        (this.finalPos[t * 9]! + this.finalPos[t * 9 + 3]! + this.finalPos[t * 9 + 6]!) / 3;
      const cy =
        (this.finalPos[t * 9 + 1]! + this.finalPos[t * 9 + 4]! + this.finalPos[t * 9 + 7]!) / 3;
      let az = Math.atan2(cy, cx) - sweepStart;
      az = ((az % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const delay = az / (2 * Math.PI);
      for (let c = 0; c < 3; c++) {
        this.tierOf[t * 3 + c] = tier;
        this.delayOf[t * 3 + c] = delay;
      }
    }
    this.maxTier = maxTier;

    // ensure attributes are dynamic-friendly copies
    displayGeometry.setAttribute('position', new BufferAttribute(new Float32Array(this.finalPos), 3));
    displayGeometry.setAttribute('normal', new BufferAttribute(new Float32Array(this.finalNormal), 3));
    displayGeometry.setAttribute('ao', new BufferAttribute(new Float32Array(this.finalAo), 1));
  }

  /** Height-scale for one corner given its tier progress. */
  private scaleOf(tierProgress: number, delay: number): number {
    const w = this.window;
    const t = (tierProgress * (1 + w) - delay * 1) / w;
    return smooth(t);
  }

  /**
   * Drive the rig: tierProgress(tier) ∈ [0,1] per tier. Rewrites positions,
   * normals, and occlusion in place.
   */
  update(tierProgress: (tier: number) => number): void {
    const pos = this.geometry.getAttribute('position') as BufferAttribute;
    const nrm = this.geometry.getAttribute('normal') as BufferAttribute;
    const ao = this.geometry.getAttribute('ao') as BufferAttribute;
    const p = pos.array as Float32Array;
    const n = nrm.array as Float32Array;
    const a = ao.array as Float32Array;
    const perTier = new Map<number, number>();
    for (let tier = 1; tier <= this.maxTier; tier++) perTier.set(tier, tierProgress(tier));

    let changed = false;
    for (const [tier, v] of perTier) {
      if (this.lastProgress.get(tier) !== v) changed = true;
    }
    if (!changed) return;
    for (const [tier, v] of perTier) this.lastProgress.set(tier, v);

    const count = this.tierOf.length;
    for (let i = 0; i < count; i++) {
      const s = this.scaleOf(perTier.get(this.tierOf[i]!)!, this.delayOf[i]!);
      p[i * 3] = this.finalPos[i * 3]!;
      p[i * 3 + 1] = this.finalPos[i * 3 + 1]!;
      p[i * 3 + 2] = this.finalPos[i * 3 + 2]! * s;
      // inverse-transpose of diag(1,1,s): (nx·s, ny·s, nz), renormalised
      const sn = Math.max(s, 0.02);
      const nx = this.finalNormal[i * 3]! * sn;
      const ny = this.finalNormal[i * 3 + 1]! * sn;
      const nz = this.finalNormal[i * 3 + 2]!;
      const len = Math.hypot(nx, ny, nz) || 1;
      n[i * 3] = nx / len;
      n[i * 3 + 1] = ny / len;
      n[i * 3 + 2] = nz / len;
      // flat tiles are open; cells earn their shadow as they rise
      a[i] = 1 + (this.finalAo[i]! - 1) * s;
    }
    pos.needsUpdate = true;
    nrm.needsUpdate = true;
    ao.needsUpdate = true;
  }
}
