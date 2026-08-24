import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { takhtPlateFull } from '@muqarnas/plan';
import { enumerateAssignments, liftVault } from '@muqarnas/lift';
import { bakeVertexAO, encodeBakedReading, vaultToGeometry } from '@muqarnas/render';
import {
  BAKED_FILES,
  LIFT_OPTS,
  PLATE_SYMMETRIES,
  PREBAKE_PARAMS,
  RECIPE_HASH,
  pickReadings,
} from '../src/recipe.js';

/**
 * The build-time bake: run the deterministic pipeline once — plan, solve,
 * lift, weld, occlusion — and write both readings as versioned binary
 * assets into public/. The site loads these instead of recomputing;
 * baked.test.ts holds them equal to a fresh run.
 *
 *   npm run prebake        (from site/)
 */

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const t0 = performance.now();
const plan = takhtPlateFull();
const report = enumerateAssignments(plan, { maxFreeOrbits: 20, symmetries: PLATE_SYMMETRIES });
const readings = pickReadings(report.solutions);
console.log(
  `plan ${plan.placed.length} elements, ${report.solutions.length} readings, picked reach ` +
    `${readings.a.graphReach}/${readings.b.graphReach} (${Math.round(performance.now() - t0)}ms)`,
);

for (const key of ['a', 'b'] as const) {
  const t = performance.now();
  const vault = liftVault(plan, readings[key].faces, LIFT_OPTS);
  const welded = vaultToGeometry(vault);
  const { min, mean } = await bakeVertexAO(welded, PREBAKE_PARAMS.ao);
  const buf = encodeBakedReading(welded, vault.tris, RECIPE_HASH);
  const file = join(outDir, BAKED_FILES[key]);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, new Uint8Array(buf));
  console.log(
    `reading ${key}: ${welded.getAttribute('position').count} vertices, ${vault.tris.length} ` +
      `triangles, ao min ${min.toFixed(3)} mean ${mean.toFixed(3)}, ` +
      `${(buf.byteLength / 1024).toFixed(0)} KiB → ${BAKED_FILES[key]} ` +
      `(${Math.round(performance.now() - t)}ms, hash ${RECIPE_HASH.toString(16)})`,
  );
}
