#!/usr/bin/env node
/**
 * Digitize the Takht-i Sulaymān plate plan from Harmsen's dissertation,
 * fig. 5.17(a) (`pl_tis_plate.fig`), via a pdftocairo SVG of page 120.
 *
 * The figure is vector art; this tool reads its line segments, snaps every
 * coordinate to the muqarnas lattice ℤ + ℤ·(√2/2) (in modules), splits
 * segments at T-junctions, extracts the faces of the planar subdivision,
 * classifies each face as an alphabet element, and emits the placements as
 * generated TypeScript (kind + isometry — never raw vertices, so the library
 * still constructs every outline from the alphabet).
 *
 * Coordinates are chosen so the vault centre (the plate's quarter-octagon
 * corner, top right in the figure) is the origin, the quarter lies in the
 * positive quadrant, the outer walls are X = 12 and Y = 12, and the plate's
 * symmetry diagonal is Y = X.
 *
 * Usage: node tools/digitize-plate.mjs <page120.svg> <out.ts>
 */

import { readFileSync, writeFileSync } from 'node:fs';

const SQ2H = Math.SQRT2 / 2;
const EPS = 1e-6;

const [, , svgPath, outPath] = process.argv;
if (!svgPath || !outPath) {
  console.error('usage: digitize-plate.mjs <page120.svg> <out.ts>');
  process.exit(1);
}
const svg = readFileSync(svgPath, 'utf8');

/* ---------- 1. collect stroked black line segments ---------- */

const rawSegs = [];
for (const m of svg.matchAll(/<path ([^>]*?)\/>/g)) {
  const attrs = m[1];
  if (!/fill="none"/.test(attrs)) continue;
  if (!/stroke="rgb\(0%, 0%, 0%\)"/.test(attrs)) continue;
  if (/stroke-dasharray/.test(attrs)) continue;
  const d = /d="([^"]+)"/.exec(attrs)?.[1];
  if (!d) continue;
  const nums = d.match(/[ML] [\d.eE+-]+ [\d.eE+-]+/g);
  if (!nums) continue;
  let prev = null;
  for (const tok of nums) {
    const [cmd, xs, ys] = tok.split(' ');
    const p = [Number(xs), Number(ys)];
    if (cmd === 'L' && prev) rawSegs.push([prev, p]);
    prev = p;
  }
}
if (rawSegs.length === 0) throw new Error('no segments found');

/* ---------- 2. isolate figure (a) by the x gap between the two figures ---------- */

const xs = [...new Set(rawSegs.flatMap(([a, b]) => [a[0], b[0]]))].sort((p, q) => p - q);
let splitX = null;
for (let i = 1; i < xs.length; i++) {
  if (xs[i] - xs[i - 1] > 300) {
    splitX = (xs[i] + xs[i - 1]) / 2;
    break;
  }
}
const segs = rawSegs.filter(([a, b]) => (splitX === null || (a[0] < splitX && b[0] < splitX)));
console.log(`segments: ${rawSegs.length} total, ${segs.length} in figure (a) (split at ${splitX?.toFixed(0) ?? 'none'})`);

/* ---------- 3. map to lattice units ---------- */

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const [a, b] of segs) {
  for (const [x, y] of [a, b]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
}
const unitX = (maxX - minX) / 12;
const unitY = (maxY - minY) / 12;
console.log(`bbox ${ (maxX - minX).toFixed(1)} × ${(maxY - minY).toFixed(1)} raw; unit x ${unitX.toFixed(3)} vs y ${unitY.toFixed(3)}`);
if (Math.abs(unitX - unitY) / unitX > 0.01) throw new Error('field is not square — wrong crop?');
const unit = (unitX + unitY) / 2;

// raw y increases upward on the page (matrix flips), so the figure top is maxY.
const toUnits = ([x, y]) => [12 - (x - minX) / unit, 12 - (y - minY) / unit];

/* ---------- 4. snap to a + b·√2/2 ---------- */

let worstResidual = 0;
const snap1 = (c) => {
  let best = null;
  for (let a = -2; a <= 14; a++) {
    for (let b = -4; b <= 4; b++) {
      const v = a + b * SQ2H;
      const r = Math.abs(c - v);
      if (!best || r < best.r) best = { a, b, v, r };
    }
  }
  worstResidual = Math.max(worstResidual, best.r);
  if (best.r > 0.08) throw new Error(`cannot snap ${c} (residual ${best.r.toFixed(4)})`);
  return best;
};
const snapPt = (p) => {
  const [ux, uy] = toUnits(p);
  const sx = snap1(ux);
  const sy = snap1(uy);
  return { xa: sx.a, xb: sx.b, ya: sy.a, yb: sy.b };
};
const val = (a, b) => a + b * SQ2H;
const px = (p) => val(p.xa, p.xb);
const py = (p) => val(p.ya, p.yb);
const pkey = (p) => `${p.xa},${p.xb}|${p.ya},${p.yb}`;

const verts = new Map();
const addVert = (p) => {
  const k = pkey(p);
  if (!verts.has(k)) verts.set(k, p);
  return verts.get(k);
};
let snapped = segs.map(([a, b]) => [addVert(snapPt(a)), addVert(snapPt(b))]).filter(([a, b]) => pkey(a) !== pkey(b));
console.log(`worst snap residual: ${worstResidual.toFixed(4)} units; vertices: ${verts.size}`);

/* ---------- 4b. de-stretch the semi-regular band ----------
 *
 * The incised design absorbs a misfit: the regular content spans
 * 7 + 3.5·√2 ≈ 11.9497 modules while the field is 12, and the excess
 * Δ = 5 − 3.5·√2 ≈ 0.0503 sits in a bent band of semi-regular quadrangles
 * running seam → central star → wall (and its mirror). The prefabricated
 * cells found at the site are unit-regular, so the vault's plan is the
 * regularized one: collapse the band by shifting the wall-anchored vertex
 * domain (per axis) by −Δ. Domains are found by flooding along edges whose
 * per-axis delta is a small lattice number; band edges carry the Δ offset
 * (|a| ≥ 4 or |b| ≥ 5 in the delta pair) and separate the domains.
 */

const DELTA = { a: 5, b: -7 }; // 5 − 3.5√2, as a lattice pair

function destretch(vertList, segList) {
  const axes = [
    { get: (p) => [p.xa, p.xb], set: (p, a, b) => ({ ...p, xa: a, xb: b }), name: 'X' },
    { get: (p) => [p.ya, p.yb], set: (p, a, b) => ({ ...p, ya: a, yb: b }), name: 'Y' },
  ];
  const shiftedByAxis = [];
  for (const axis of axes) {
    const isStretched = ([a, b]) => Math.abs(a) >= 4 || Math.abs(b) >= 5;
    const adj = new Map(); // key -> Set of keys joined by regular edges
    const link = (u, v) => {
      if (!adj.has(u)) adj.set(u, new Set());
      adj.get(u).add(v);
    };
    for (const [p, q] of segList) {
      const [pa, pb] = axis.get(p);
      const [qa, qb] = axis.get(q);
      const d = [qa - pa, qb - pb];
      if (!isStretched(d)) {
        link(pkey(p), pkey(q));
        link(pkey(q), pkey(p));
      }
    }
    // seeds: clearly centre-side (value < 4) fixed, clearly wall-side (> 9) shifted
    const cls = new Map();
    const queue = [];
    for (const v of vertList) {
      const [a, b] = axis.get(v);
      const value = val(a, b);
      if (value < 4 - 1e-9) {
        cls.set(pkey(v), 'fixed');
        queue.push(pkey(v));
      } else if (value > 9 + 1e-9) {
        cls.set(pkey(v), 'shifted');
        queue.push(pkey(v));
      }
    }
    while (queue.length) {
      const k = queue.pop();
      for (const n of adj.get(k) ?? []) {
        if (!cls.has(n)) {
          cls.set(n, cls.get(k));
          queue.push(n);
        } else if (cls.get(n) !== cls.get(k)) {
          throw new Error(`${axis.name} domain conflict at ${n}`);
        }
      }
    }
    let un = 0;
    for (const v of vertList) if (!cls.has(pkey(v))) un++;
    if (un) console.warn(`  ${axis.name}: ${un} vertices unreached by domain flood`);
    // stretched edges must join fixed→shifted with the larger value on the shifted side
    for (const [p, q] of segList) {
      const [pa, pb] = axis.get(p);
      const [qa, qb] = axis.get(q);
      if (isStretched([qa - pa, qb - pb])) {
        const cp = cls.get(pkey(p));
        const cq = cls.get(pkey(q));
        if (cp && cq && cp === cq) throw new Error(`${axis.name} stretched edge inside one domain`);
        const hi = val(qa, qb) > val(pa, pb) ? cq : cp;
        if (hi && hi !== 'shifted') throw new Error(`${axis.name} stretched edge oriented wrong`);
      }
    }
    shiftedByAxis.push(cls);
  }
  // remap
  const remap = new Map();
  for (const v of vertList) {
    let p = v;
    if (shiftedByAxis[0].get(pkey(v)) === 'shifted') p = { ...p, xa: p.xa - DELTA.a, xb: p.xb - DELTA.b };
    if (shiftedByAxis[1].get(pkey(v)) === 'shifted') p = { ...p, ya: p.ya - DELTA.a, yb: p.yb - DELTA.b };
    remap.set(pkey(v), p);
  }
  const outVerts = new Map();
  const outAdd = (p) => {
    const k = pkey(p);
    if (!outVerts.has(k)) outVerts.set(k, p);
    return outVerts.get(k);
  };
  const outSegs = segList
    .map(([p, q]) => [outAdd(remap.get(pkey(p))), outAdd(remap.get(pkey(q)))])
    .filter(([p, q]) => pkey(p) !== pkey(q));
  return { verts: outVerts, segs: outSegs };
}

/* ---------- 5+6. split, dedupe, face extraction (as a pass) ---------- */

const area2 = (loop) => {
  let s = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i], q = loop[(i + 1) % loop.length];
    s += px(p) * py(q) - px(q) * py(p);
  }
  return s;
};

function extractFaces(vertsMap, segList) {
  const allVerts = [...vertsMap.values()];
  const splitSegs = [];
  for (const [a, b] of segList) {
    const ax = px(a), ay = py(a), bx = px(b), by = py(b);
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const inside = allVerts
      .filter((v) => {
        if (v === a || v === b) return false;
        const wx = px(v) - ax, wy = py(v) - ay;
        if (Math.abs(wx * dy - wy * dx) > EPS) return false;
        const t = (wx * dx + wy * dy) / len2;
        return t > EPS && t < 1 - EPS;
      })
      .sort((u, v) => {
        const tu = ((px(u) - ax) * dx + (py(u) - ay) * dy);
        const tv = ((px(v) - ax) * dx + (py(v) - ay) * dy);
        return tu - tv;
      });
    const stops = [a, ...inside, b];
    for (let i = 0; i + 1 < stops.length; i++) splitSegs.push([stops[i], stops[i + 1]]);
  }
  const edgeSet = new Map();
  for (const [a, b] of splitSegs) {
    const k = [pkey(a), pkey(b)].sort().join('~');
    if (!edgeSet.has(k)) edgeSet.set(k, [a, b]);
  }
  const edges = [...edgeSet.values()];

  const nbrs = new Map(); // vertexKey -> [{v, angle}]
  const addNbr = (a, b) => {
    const k = pkey(a);
    if (!nbrs.has(k)) nbrs.set(k, []);
    nbrs.get(k).push({ v: b, angle: Math.atan2(py(b) - py(a), px(b) - px(a)) });
  };
  for (const [a, b] of edges) {
    addNbr(a, b);
    addNbr(b, a);
  }
  for (const list of nbrs.values()) list.sort((p, q) => p.angle - q.angle);

  const usedDirected = new Set();
  const faces = [];
  for (const [a, b] of edges) {
    for (const [u, v] of [[a, b], [b, a]]) {
      const dkey = `${pkey(u)}>${pkey(v)}`;
      if (usedDirected.has(dkey)) continue;
      const loop = [];
      let cu = u, cv = v;
      let guard = 0;
      while (true) {
        if (guard++ > 10000) throw new Error('face walk did not close');
        usedDirected.add(`${pkey(cu)}>${pkey(cv)}`);
        loop.push(cv);
        const list = nbrs.get(pkey(cv));
        const back = Math.atan2(py(cu) - py(cv), px(cu) - px(cv));
        let next = null;
        let bestDelta = Infinity;
        for (const cand of list) {
          let delta = back - cand.angle; // clockwise distance
          while (delta <= EPS) delta += 2 * Math.PI;
          if (delta < bestDelta) {
            bestDelta = delta;
            next = cand.v;
          }
        }
        cu = cv;
        cv = next;
        if (pkey(cu) === pkey(u) && pkey(cv) === pkey(v)) break;
      }
      faces.push(loop);
    }
  }
  const interior = faces.filter((f) => area2(f) > EPS);
  const outer = faces.filter((f) => area2(f) <= EPS);
  return { edges, splitSegs, interior, outer };
}

/* ---------- 7. classify faces as alphabet elements ---------- */

// canonical vertices as lattice pairs [xa, xb, ya, yb] (value a + b·√2/2)
const CANON_PAIRS = {
  square: [[0, 0, 0, 0], [1, 0, 0, 0], [1, 0, 1, 0], [0, 0, 1, 0]],
  rhombus: [[0, 0, 0, 0], [1, 0, 0, 0], [1, 1, 0, 1], [0, 1, 0, 1]],
  'half-square': [[0, 0, 0, 0], [1, 0, 0, 0], [1, 0, 1, 0]],
  'half-rhombus': [[0, 0, 0, 0], [1, 0, 0, 0], [0, 1, 0, 1]],
  jug: [[0, 0, 0, 0], [1, 0, 0, 0], [0, 1, 0, 1], [0, 0, 1, 0]],
};
const CANON = Object.fromEntries(
  Object.entries(CANON_PAIRS).map(([k, vs]) => [k, vs.map(([xa, xb, ya, yb]) => [val(xa, xb), val(ya, yb)])]),
);

/* Exact lattice arithmetic for the emitted translations: numbers (m + n√2)/D
 * with integer m, n. One 45°-rotation multiplies by √2/2 at most once per
 * term, doubling D once; translations must land back on D = 4 pair form. */
const latNum = (a, b) => ({ m: 2 * a, n: b, D: 2 }); // a + b·√2/2
const latLift = (x) => ({ m: 2 * x.m, n: 2 * x.n, D: 2 * x.D });
const latNeg = (x) => ({ m: -x.m, n: -x.n, D: x.D });
const latMulHalfSqrt2 = (x) => ({ m: 2 * x.n, n: x.m, D: 2 * x.D }); // ×√2/2
const latAdd = (x, y) => {
  if (x.D !== y.D) throw new Error('lattice denominator mismatch');
  return { m: x.m + y.m, n: x.n + y.n, D: x.D };
};
const latToPair = (x) => {
  // (m + n√2)/D = a + (b/2)·√2·... require m ≡ 0 (mod D) and 2n ≡ 0 (mod D)
  if (x.m % x.D !== 0 || (2 * x.n) % x.D !== 0) throw new Error('translation off the lattice');
  return [x.m / x.D, (2 * x.n) / x.D];
};
// cos/sin of k·45° as tokens: 1, s (√2/2), 0, −s, −1 …
const TRIG = [
  ['1', '0'], ['s', 's'], ['0', '1'], ['-s', 's'], ['-1', '0'], ['-s', '-s'], ['0', '-1'], ['s', '-s'],
];
const latMulTok = (tok, x) => {
  switch (tok) {
    case '0': return { m: 0, n: 0, D: 2 * x.D };
    case '1': return latLift(x);
    case '-1': return latLift(latNeg(x));
    case 's': return latMulHalfSqrt2(x);
    case '-s': return latNeg(latMulHalfSqrt2(x));
    default: throw new Error(tok);
  }
};
/** Exact image of canonical vertex [xa,xb,ya,yb] under refl(x-axis)?→rot k. */
const latTransform = (pair, refl, k) => {
  const X = latNum(pair[0], pair[1]);
  const Y0 = latNum(pair[2], pair[3]);
  const Y = refl ? latNeg(Y0) : Y0;
  const [c, s] = TRIG[k];
  const negs = s === '0' ? '0' : s.startsWith('-') ? s.slice(1) : `-${s}`;
  return {
    x: latAdd(latMulTok(c, X), latMulTok(negs, Y)),
    y: latAdd(latMulTok(s, X), latMulTok(c, Y)),
  };
};
const rot = (k, [x, y]) => {
  const c = Math.cos((k * Math.PI) / 4);
  const s = Math.sin((k * Math.PI) / 4);
  return [x * c - y * s, x * s + y * c];
};
const classify = (loop) => {
  const pts = loop.map((p) => [px(p), py(p)]);
  for (const [kind, canon] of Object.entries(CANON)) {
    if (canon.length !== pts.length) continue;
    for (const refl of [false, true]) {
      const base = canon.map(([x, y]) => (refl ? [x, -y] : [x, y]));
      // reflection reverses orientation; walk canonical CCW either way
      const seq = refl ? [...base].reverse() : base;
      for (let k = 0; k < 8; k++) {
        const rt = seq.map((p) => rot(k, p));
        for (let off = 0; off < pts.length; off++) {
          const tx = pts[off][0] - rt[0][0];
          const ty = pts[off][1] - rt[0][1];
          let ok = true;
          for (let i = 0; i < pts.length && ok; i++) {
            const q = pts[(off + i) % pts.length];
            if (Math.abs(q[0] - (rt[i][0] + tx)) > 1e-4 || Math.abs(q[1] - (rt[i][1] + ty)) > 1e-4) ok = false;
          }
          if (ok) {
            // translation = anchor face vertex − image of its canonical
            // partner, in exact lattice-pair arithmetic (no float snapping)
            const j0 = refl ? pts.length - 1 : 0;
            const img = latTransform(CANON_PAIRS[kind][j0], refl, k);
            const anchor = loop[off];
            const txp = latToPair(latAdd(latLift(latNum(anchor.xa, anchor.xb)), latNeg(img.x)));
            const typ = latToPair(latAdd(latLift(latNum(anchor.ya, anchor.yb)), latNeg(img.y)));
            return { kind, rot: k, refl, tx: txp, ty: typ };
          }
        }
      }
    }
  }
  return null;
};

function classifyAll(interior) {
  const placements = [];
  const unresolved = [];
  for (const f of interior) {
    const c = classify(f);
    if (c) placements.push(c);
    else unresolved.push(f);
  }
  return { placements, unresolved };
}

let pass = extractFaces(verts, snapped);
let result = classifyAll(pass.interior);
console.log(`pass 1: ${pass.interior.length} faces, ${result.unresolved.length} unresolved`);
let destretched = false;
if (result.unresolved.length) {
  console.log('de-stretching the semi-regular band…');
  const ds = destretch([...verts.values()], pass.splitSegs);
  pass = extractFaces(ds.verts, ds.segs);
  result = classifyAll(pass.interior);
  destretched = true;
  console.log(`pass 2: ${pass.interior.length} faces, ${result.unresolved.length} unresolved`);
}
const { placements } = result;

/* Hexagon completion: a six-sided face that splits along a unit diagonal
 * into two alphabet elements is missing exactly one drawn edge (on the plate
 * this happens at a removable diagonal node — Harmsen's fig omits the edge
 * at the six-rhombi join). Restore the edge and place both halves. */
const stillUnresolved = [];
for (const f of result.unresolved) {
  let done = false;
  if (f.length === 6) {
    for (let k = 0; k < 3 && !done; k++) {
      const a = f[k], b = f[(k + 3) % 6];
      const d = Math.hypot(px(b) - px(a), py(b) - py(a));
      if (Math.abs(d - 1) > 1e-6) continue;
      const quadA = [f[k], f[(k + 1) % 6], f[(k + 2) % 6], f[(k + 3) % 6]];
      const quadB = [f[(k + 3) % 6], f[(k + 4) % 6], f[(k + 5) % 6], f[k]];
      const ca = classify(quadA);
      const cb = classify(quadB);
      if (ca && cb) {
        placements.push(ca, cb);
        console.log(
          `completed hexagon at (${px(f[k]).toFixed(3)}, ${py(f[k]).toFixed(3)}) as ${ca.kind} + ${cb.kind} (restored its diagonal edge)`,
        );
        done = true;
      }
    }
  }
  if (!done) stillUnresolved.push(f);
}

const census = {};
for (const p of placements) census[p.kind] = (census[p.kind] ?? 0) + 1;
console.log('census:', census);
if (stillUnresolved.length) {
  console.log(`UNRESOLVED faces: ${stillUnresolved.length}`);
  for (const f of stillUnresolved) {
    console.log('  ', JSON.stringify(f.map((p) => [px(p).toFixed(3), py(p).toFixed(3)])));
  }
  process.exit(1);
}
const interior = pass.interior;
const outer = pass.outer;
if (outer.length !== 1) console.warn(`WARNING: expected one outer face, got ${outer.length}`);

/* ---------- 8. sector polygon (outer face boundary, reversed to CCW) ---------- */

const sectorLoop = outer.length === 1 ? [...outer[0]].reverse() : [];
// drop collinear intermediate vertices for a clean polygon
const cleaned = [];
for (let i = 0; i < sectorLoop.length; i++) {
  const a = sectorLoop[(i - 1 + sectorLoop.length) % sectorLoop.length];
  const b = sectorLoop[i];
  const c = sectorLoop[(i + 1) % sectorLoop.length];
  const cross = (px(b) - px(a)) * (py(c) - py(a)) - (py(b) - py(a)) * (px(c) - px(a));
  if (Math.abs(cross) > EPS) cleaned.push(b);
}
console.log(`sector polygon: ${cleaned.length} corners`);

/* ---------- 9. emit ---------- */

const header = `/**
 * GENERATED by tools/digitize-plate.mjs — do not edit by hand.
 *
 * Element placements of the Takht-i Sulaymān plate plan, from Harmsen's
 * digitization (diss. Heidelberg 2006, fig. 5.17(a), pl_tis_plate.fig: the
 * design as read by Harb with the diagonal hexagons' inner lines normalized
 * to standard elements), extracted from vector line work and snapped to the
 * lattice ℤ + ℤ·(√2/2). Coordinates in modules; the vault centre is the
 * origin; outer walls at X = 12 and Y = 12; symmetry diagonal Y = X.
 *
 * Numbers are lattice pairs [a, b] meaning a + b·(√2/2).
 */
`;
const pl = placements
  .map((p) => `  { kind: '${p.kind}', rot: ${p.rot}, refl: ${p.refl}, tx: [${p.tx}], ty: [${p.ty}] },`)
  .join('\n');
const sec = cleaned.map((p) => `  [[${p.xa}, ${p.xb}], [${p.ya}, ${p.yb}]],`).join('\n');
const counts = Object.entries(census)
  .map(([k, n]) => `${k}: ${n}`)
  .join(', ');
writeFileSync(
  outPath,
  `${header}
export interface PlatePlacement {
  readonly kind: 'square' | 'rhombus' | 'half-square' | 'half-rhombus' | 'jug';
  readonly rot: number;
  readonly refl: boolean;
  readonly tx: readonly [number, number];
  readonly ty: readonly [number, number];
}

/** ${placements.length} elements — ${counts}. */
export const PLATE_PLACEMENTS: readonly PlatePlacement[] = [
${pl}
];

/** Sector polygon (CCW), lattice pairs. */
export const PLATE_SECTOR: ReadonlyArray<readonly [readonly [number, number], readonly [number, number]]> = [
${sec}
];
`,
);
console.log(`wrote ${outPath}: ${placements.length} placements, sector ${cleaned.length} corners`);
