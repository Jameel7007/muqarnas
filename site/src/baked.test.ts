import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { takhtPlateFull } from '@muqarnas/plan';
import { enumerateAssignments, liftVault } from '@muqarnas/lift';
import {
  bakeVertexAO,
  decodeBakedReading,
  toDisplayGeometry,
  vaultToGeometry,
  withPaintAttribute,
} from '@muqarnas/render';
import { LIFT_OPTS, PLATE_SYMMETRIES, PREBAKE_PARAMS, RECIPE_HASH, pickReadings } from './recipe.js';

/**
 * The baked assets ARE the vault the visitor sees, so they are held to
 * the strongest standard available: bitwise equality against a fresh run
 * of the full pipeline (every stage is deterministic — the AO bake is
 * seeded). This is the staleness guard the params hash cannot provide:
 * the hash catches changed knobs, this test catches changed algorithms.
 * If it fails, re-run `npm run prebake` in site/ and commit the assets.
 */

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const load = (f: string) => {
  const b = readFileSync(join(pub, f));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

describe('pre-baked vault assets', () => {
  it('decode, and reject a stale hash', () => {
    const buf = load('baked/reading-a.bin');
    expect(decodeBakedReading(buf, RECIPE_HASH)).not.toBeNull();
    expect(decodeBakedReading(buf, RECIPE_HASH ^ 1)).toBeNull();
  });

  it('reading A carries the caption\'s seventeen tiers; B is a different building', () => {
    // note: the solver's graphReach (17/18) counts the crown rim's node,
    // which emits no triangle ring of its own — lifted tiers top out at 17
    // in both readings, exactly as scene 7's caption states for A
    const a = decodeBakedReading(load('baked/reading-a.bin'), RECIPE_HASH)!;
    const b = decodeBakedReading(load('baked/reading-b.bin'), RECIPE_HASH)!;
    expect(Math.max(...a.tris.map((t) => t.tier ?? 0))).toBe(17);
    expect(Math.max(...b.tris.map((t) => t.tier ?? 0))).toBeGreaterThanOrEqual(17);
    expect(b.welded.getAttribute('position').array).not.toEqual(
      a.welded.getAttribute('position').array,
    );
  });

  it('reading A is bitwise identical to a fresh run of the pipeline', async () => {
    const baked = decodeBakedReading(load('baked/reading-a.bin'), RECIPE_HASH)!;

    const plan = takhtPlateFull();
    const report = enumerateAssignments(plan, { maxFreeOrbits: 20, symmetries: PLATE_SYMMETRIES });
    const vault = liftVault(plan, pickReadings(report.solutions).a.faces, LIFT_OPTS);
    const fresh = vaultToGeometry(vault);
    await bakeVertexAO(fresh, PREBAKE_PARAMS.ao);

    // stored artifacts: geometry, index, occlusion, triangle metadata
    expect(baked.welded.getAttribute('position').array).toEqual(
      fresh.getAttribute('position').array,
    );
    expect(Array.from(baked.welded.getIndex()!.array)).toEqual(
      Array.from(fresh.getIndex()!.array),
    );
    expect(baked.welded.getAttribute('ao').array).toEqual(fresh.getAttribute('ao').array);
    expect(baked.tris.length).toBe(vault.tris.length);
    for (let t = 0; t < vault.tris.length; t++) {
      expect(baked.tris[t]!.role).toBe(vault.tris[t]!.role);
      expect(baked.tris[t]!.cell).toBe(vault.tris[t]!.cell);
      expect(baked.tris[t]!.tier).toBe(vault.tris[t]!.tier);
    }

    // derived artifacts: the runtime recomputes creased normals and the
    // paint map from the stored data — prove the derivation lands on the
    // same ornament frames either way
    const bakedDisplay = withPaintAttribute(toDisplayGeometry(baked.welded), baked.tris);
    const freshDisplay = withPaintAttribute(toDisplayGeometry(fresh), vault.tris);
    expect(bakedDisplay.getAttribute('orn').array).toEqual(freshDisplay.getAttribute('orn').array);
    expect(bakedDisplay.getAttribute('paint').array).toEqual(
      freshDisplay.getAttribute('paint').array,
    );
  }, 120_000);
});
