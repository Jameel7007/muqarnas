import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { takhtPlate, takhtPlateFull } from '@muqarnas/plan';
import { decodeBakedReading } from '@muqarnas/render';
import { BAKED_FILES, RECIPE_HASH } from '../src/recipe.js';

/**
 * The narration counts letters and tiers. Those numbers used to be injected
 * by JavaScript into em-dash placeholders, so without JS — a crawler, a
 * blocked bundle, a reader with scripting off — the prose read "spells the
 * sky with — letters". They are static in the HTML now, and this tool is what
 * keeps them honest: it computes each one from the geometry itself and either
 * writes it in or checks it.
 *
 *   npm run tallies          check site/index.html
 *   npm run tallies -- --write   rewrite it from the geometry
 *   npm run tallies -- --check dist/index.html
 *
 * CI runs the check against the BUILT page, so the prose cannot drift from
 * the plan package, and no placeholder can ship empty.
 */

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_HTML = join(here, '..', 'index.html');

export function computeTallies(): Record<string, number> {
  const full = takhtPlateFull();
  const quarter = takhtPlate();
  const kind = (k: string) => full.placed.filter((q) => q.def.kind === k).length;

  const file = join(here, '..', 'public', BAKED_FILES.a);
  const buf = readFileSync(file);
  const baked = decodeBakedReading(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    RECIPE_HASH,
  );
  if (!baked) throw new Error(`tallies: ${BAKED_FILES.a} did not decode (stale recipe hash?)`);
  const tiers = Math.max(...baked.tris.map((t) => t.tier ?? 0));

  return {
    total: full.placed.length,
    quarter: quarter.placed.length,
    squares: kind('square'),
    rhombi: kind('rhombus'),
    halfRhombi: kind('half-rhombus'),
    jugs: kind('jug'),
    tiers,
  };
}

const SPAN = /(<span[^>]*\bdata-tally="([A-Za-z]+)"[^>]*>)([^<]*)(<\/span>)/g;

const args = process.argv.slice(2);
const write = args.includes('--write');
const target = args.find((a) => !a.startsWith('--')) ?? DEFAULT_HTML;

const tallies = computeTallies();
const html = readFileSync(target, 'utf8');

let seen = 0;
const problems: string[] = [];
const next = html.replace(SPAN, (_m, open: string, key: string, text: string, close: string) => {
  seen++;
  const want = tallies[key];
  if (want === undefined) {
    problems.push(`unknown tally key "${key}"`);
    return `${open}${text}${close}`;
  }
  const shown = text.trim();
  if (shown === '') problems.push(`tally "${key}" is empty in the markup`);
  else if (shown !== String(want)) problems.push(`tally "${key}" reads ${shown}, geometry says ${want}`);
  return `${open}${want}${close}`;
});

if (seen === 0) {
  console.error(`tallies: no [data-tally] spans found in ${target}`);
  process.exit(1);
}

if (write) {
  writeFileSync(target, next);
  console.log(`tallies: wrote ${seen} value(s) into ${target}`);
  console.log(Object.entries(tallies).map(([k, v]) => `  ${k} = ${v}`).join('\n'));
} else if (problems.length) {
  console.error(`tallies: ${target} disagrees with the geometry`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('run `npm run tallies -- --write` in site/ to reconcile');
  process.exit(1);
} else {
  console.log(`tallies: ${seen} value(s) in ${target} match the geometry`);
}
