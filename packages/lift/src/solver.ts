import {
  Pt,
  cross2,
  interiorAngleUnits,
  worldOutline,
  type ElementKind,
  type Plan,
  type Role,
} from '@muqarnas/plan';

/**
 * The tier solver — Harmsen's reconstruction algorithm (diss. Heidelberg
 * 2006, ch. 3), the formal statement of the fact this whole project turns
 * on: THE PLAN DOES NOT DETERMINE THE VAULT.
 *
 * Every plan edge is a candidate arrow of the muqarnas graph, pointing "up"
 * — along a curved side toward its apex. Arrows raise the tier height by
 * exactly one (Lemma 3.1.3), so valid graphs are exactly those whose height
 * propagation stabilises (A-3.1/3.2/3.3; divergence = a cycle or unequal
 * path lengths = unbuildable). Opposite edges of a quad share direction
 * (Lemma 3.1.7), which binds edges into ORBITS; the direction rules pin
 * most orbits:
 *
 *   R1  arrows leave non-singular bottom-boundary nodes (the outward wall
 *       corners are the springing's low points; the inward notches — the
 *       singular nodes — are tier-1 apexes, which is why wall heights
 *       zigzag 0,1,0,1),
 *   R2  (alternative form, for non-regular centres like the plate's)
 *       orbits without centre-internal edges direct their centre-touching
 *       edges into the centre,
 *   R4  no interior source; interior sinks only as a dome's single apex.
 *
 * Fixed element anatomy forces more: a jug or almond is cell-only, so its
 * curved sides point INTO its central node; bipeds are intermediate-only,
 * pointing out; the halves couple their two legs by parity. What remains
 * free after all of this — the undetermined orbits — is the genuine
 * ambiguity, and enumerating those choices enumerates the different vaults
 * one plan can carry.
 *
 * Faces then read their own element off their boundary arrows: a corner
 * with both edges pointing in is a cell's apex (tier = its height); both
 * pointing out, an intermediate's foot (tier = height + 1); cells claim
 * first, per Harmsen's administration.
 */

export interface SolvedFace {
  readonly placedIndex: number;
  readonly type: 'cell' | 'intermediate';
  /** World-outline vertex index of the apex (cell) or foot (intermediate). */
  readonly centralNode: number;
  readonly tier: number;
}

export interface TierSolution {
  readonly tierCount: number;
  /**
   * Maximum node height in the graph — the tier the structure reaches at
   * the crown rim. This is the figure comparable with the published tier
   * counts (which include the crown resolution the plan's central hole
   * leaves open); face tiers top out one or two below it when the topmost
   * arrows climb the rim without being any plan face's apex.
   */
  readonly graphReach: number;
  readonly faces: readonly SolvedFace[];
  /** Free-orbit choices that produced this solution (for reproducibility). */
  readonly choices: readonly boolean[];
  /** Edge directions: key = canonical edge key, value = true when a→b. */
  readonly directions: ReadonlyMap<string, boolean>;
  /** Node heights by vertex key. */
  readonly heights: ReadonlyMap<string, number>;
}

export interface SolverReport {
  readonly solutions: readonly TierSolution[];
  readonly freeOrbits: number;
  readonly candidatesTried: number;
  readonly conflicts: readonly string[];
  readonly wallNodes: number;
  readonly centreNodes: number;
  readonly rejected: {
    heights: number;
    sources: number;
    sinks: number;
    faceReading: number;
  };
}

export interface SolverOptions {
  readonly maxFreeOrbits?: number;
  /**
   * Isometries the direction assignment must respect (e.g. the vault's
   * rotations and mirror). Each symmetry merges orbits with their images,
   * which is what solving a symmetric quarter does implicitly — without it,
   * a full 8-fold vault enumerates every asymmetric variant separately.
   */
  readonly symmetries?: readonly import('@muqarnas/plan').Iso[];
}

interface FaceInfo {
  placedIndex: number;
  kind: ElementKind;
  roles: readonly Role[];
  verts: Pt[];
  fixedCentral: number | null;
  edgeIdx: number[]; // per side i: index into edges
}

interface EdgeInfo {
  key: string;
  a: Pt;
  b: Pt;
  sides: Array<{ face: number; ab: boolean }>; // ab: the face traverses a→b
}

export function enumerateAssignments(plan: Plan, opts: SolverOptions = {}): SolverReport {
  const conflicts: string[] = [];

  /* ---------- faces and edges ---------- */
  const faces: FaceInfo[] = plan.placed.map((p, i) => {
    const { verts, centralNode } = worldOutline(p);
    return {
      placedIndex: i,
      kind: p.def.kind,
      roles: p.def.roles,
      verts,
      fixedCentral: centralNode,
      edgeIdx: [],
    };
  });

  const edges: EdgeInfo[] = [];
  const edgeByKey = new Map<string, number>();
  faces.forEach((f, fi) => {
    const n = f.verts.length;
    for (let i = 0; i < n; i++) {
      const va = f.verts[i]!;
      const vb = f.verts[(i + 1) % n]!;
      const ka = va.key();
      const kb = vb.key();
      const forward = ka < kb;
      const key = forward ? `${ka}~${kb}` : `${kb}~${ka}`;
      let ei = edgeByKey.get(key);
      if (ei === undefined) {
        ei = edges.length;
        edges.push({ key, a: forward ? va : vb, b: forward ? vb : va, sides: [] });
        edgeByKey.set(key, ei);
      }
      edges[ei]!.sides.push({ face: fi, ab: forward });
      f.edgeIdx.push(ei);
    }
  });
  for (const e of edges) {
    if (e.sides.length > 2) throw new Error(`solver: edge ${e.key} borders ${e.sides.length} faces`);
  }

  /* ---------- front joints: edges that are not in the graph ----------
   * A fixed-anatomy face uses exactly the two edges at its central node as
   * curved sides; its remaining edges are backsides/fronts. An edge whose
   * EVERY adjacent face treats it as a fixed backside is a front joint
   * (back-on-front or front-to-front) and is not a graph arrow at all
   * (Def 3.1.1). A fixed backside abutting a FREE face would be a genuine
   * membership ambiguity — not needed for our plans, so it is an error.
   */
  const fixedBacksideCount = edges.map(() => 0);
  faces.forEach((f) => {
    if (f.fixedCentral === null) return;
    const n = f.verts.length;
    for (let i = 0; i < n; i++) {
      const isCurved = i === f.fixedCentral || i === (f.fixedCentral - 1 + n) % n;
      if (!isCurved) fixedBacksideCount[f.edgeIdx[i]!]!++;
    }
  });
  const excluded = edges.map((e, i) => fixedBacksideCount[i]! > 0 && fixedBacksideCount[i]! === e.sides.length);
  edges.forEach((e, i) => {
    if (fixedBacksideCount[i]! > 0 && !excluded[i] && e.sides.length === 2) {
      const other = e.sides.map((s) => faces[s.face]!.kind).join('/');
      throw new Error(
        `solver: edge ${e.key} is a fixed backside on one side but faces a free element (${other}) — membership ambiguity not supported yet`,
      );
    }
  });

  /* ---------- boundary loops (wall vs centre holes) ---------- */
  const boundaryEdges = edges.filter((e) => e.sides.length === 1);
  // walk loops in face-traversal direction (interior on the left)
  const nextFrom = new Map<string, { edge: EdgeInfo; to: Pt }>();
  for (const e of boundaryEdges) {
    const s = e.sides[0]!;
    const from = s.ab ? e.a : e.b;
    const to = s.ab ? e.b : e.a;
    if (nextFrom.has(from.key())) {
      const [x, y] = from.toNumbers();
      throw new Error(`solver: branching boundary at (${x.toFixed(4)}, ${y.toFixed(4)})`);
    }
    nextFrom.set(from.key(), { edge: e, to });
  }
  const loops: Pt[][] = [];
  const seenStart = new Set<string>();
  for (const e of boundaryEdges) {
    const s = e.sides[0]!;
    const start = s.ab ? e.a : e.b;
    if (seenStart.has(start.key())) continue;
    const loop: Pt[] = [];
    let cur = start;
    let guard = 0;
    do {
      if (guard++ > boundaryEdges.length + 1) throw new Error('solver: boundary loop does not close');
      seenStart.add(cur.key());
      loop.push(cur);
      const step = nextFrom.get(cur.key());
      if (!step) throw new Error('solver: open boundary chain (T-junction?)');
      cur = step.to;
    } while (cur.key() !== start.key());
    loops.push(loop);
  }
  if (loops.length === 0) throw new Error('solver: no boundary found');
  // wall = loop with the largest bbox extent
  const extent = (loop: Pt[]) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of loop) {
      const [x, y] = p.toNumbers();
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return maxX - minX + (maxY - minY);
  };
  let wallIdx = 0;
  for (let i = 1; i < loops.length; i++) if (extent(loops[i]!) > extent(loops[wallIdx]!)) wallIdx = i;
  const wallLoop = loops[wallIdx]!;
  const wallSet = new Set(wallLoop.map((p) => p.key()));
  const centreSet = new Set<string>();
  loops.forEach((loop, i) => {
    if (i !== wallIdx) for (const p of loop) centreSet.add(p.key());
  });
  const boundarySet = new Set([...wallSet, ...centreSet]);

  // singular / non-singular wall nodes: outward (left-turn on the CCW wall
  // walk) or collinear nodes are non-singular; inward notches are singular
  const nonSingular = new Set<string>();
  const L = wallLoop.length;
  for (let i = 0; i < L; i++) {
    const u = wallLoop[(i - 1 + L) % L]!;
    const v = wallLoop[i]!;
    const w = wallLoop[(i + 1) % L]!;
    const turn = cross2(v.sub(u), w.sub(v)).sign();
    if (turn >= 0) nonSingular.add(v.key());
  }

  /* ---------- orbits: union-find with parity ---------- */
  // value(edge) ∈ {0,1}: 0 means directed a→b (canonical), 1 means b→a
  const parent = edges.map((_, i) => i);
  const parity = edges.map(() => 0); // parity to parent
  const find = (x: number): [number, number] => {
    if (parent[x] === x) return [x, 0];
    const [r, p] = find(parent[x]!);
    parent[x] = r;
    parity[x] = (parity[x]! + p) % 2;
    return [r, parity[x]!];
  };
  const union = (x: number, y: number, rel: number) => {
    // value(x) ⊕ value(y) = rel
    const [rx, px] = find(x);
    const [ry, py] = find(y);
    if (rx === ry) {
      if ((px ^ py) !== rel) conflicts.push(`orbit parity conflict at edges ${edges[x]!.key} / ${edges[y]!.key}`);
      return;
    }
    parent[rx] = ry;
    parity[rx] = (px ^ py ^ rel) as number;
  };

  // opposite edges of quads share direction (Lemma 3.1.7), unless a cross
  // edge (a drawn diagonal) exists in the plan; the pair and its connectors
  // must all be graph members
  for (const f of faces) {
    if (f.verts.length !== 4) continue;
    if (f.edgeIdx.some((ei) => excluded[ei])) continue;
    const dkey = (p: Pt, q: Pt) => {
      const kp = p.key();
      const kq = q.key();
      return kp < kq ? `${kp}~${kq}` : `${kq}~${kp}`;
    };
    const diag02 = edgeByKey.has(dkey(f.verts[0]!, f.verts[2]!));
    const diag13 = edgeByKey.has(dkey(f.verts[1]!, f.verts[3]!));
    if (diag02 || diag13) continue;
    for (const [i, j] of [
      [0, 2],
      [1, 3],
    ] as const) {
      const ei = f.edgeIdx[i]!;
      const ej = f.edgeIdx[j]!;
      // side i traversed v_i→v_{i+1}; the lemma pairs it with side j
      // traversed in REVERSE (v_{j+1}→v_j): same absolute direction
      const abI = faceSideAb(f, i, edges[ei]!);
      const abJ = faceSideAb(f, j, edges[ej]!);
      const valueIfTraversal = (ab: boolean) => (ab ? 0 : 1);
      const rel = (valueIfTraversal(abI) ^ valueIfTraversal(!abJ)) as number;
      union(ei, ej, rel);
    }
  }

  function faceSideAb(f: FaceInfo, side: number, e: EdgeInfo): boolean {
    const va = f.verts[side]!;
    return e.a.key() === va.key();
  }

  // symmetry: directions must be invariant under the given isometries
  for (const S of opts.symmetries ?? []) {
    edges.forEach((e, i) => {
      if (excluded[i]) return;
      const ia = S.apply(e.a);
      const ib = S.apply(e.b);
      const ka = ia.key();
      const kb = ib.key();
      const key = ka < kb ? `${ka}~${kb}` : `${kb}~${ka}`;
      const j = edgeByKey.get(key);
      if (j === undefined) {
        conflicts.push(`symmetry image of edge ${e.key} is not in the plan`);
        return;
      }
      // e directed a→b maps to image directed ia→ib
      const rel = edges[j]!.a.key() === ka ? 0 : 1;
      union(i, j, rel);
    });
  }

  /* ---------- forcings ---------- */
  const forced = new Map<number, number>(); // root -> value of root representative
  const force = (edge: number, value: 0 | 1, why: string) => {
    const [r, p] = find(edge);
    const rv = (value ^ p) as number;
    const prev = forced.get(r);
    if (prev !== undefined && prev !== rv) {
      conflicts.push(`direction conflict (${why}) at edge ${edges[edge]!.key}`);
      return;
    }
    forced.set(r, rv);
  };
  /** Force edge so it points INTO the vertex with key vk (or out, if into=false). */
  const forceToward = (edge: number, vk: string, into: boolean, why: string) => {
    const e = edges[edge]!;
    const towardB = e.b.key() === vk;
    if (!towardB && e.a.key() !== vk) throw new Error('forceToward: vertex not on edge');
    const value = (towardB === into ? 0 : 1) as 0 | 1;
    force(edge, value, why);
  };

  // Rule 1: arrows leave non-singular bottom-boundary nodes
  edges.forEach((e, i) => {
    if (excluded[i]) return;
    const aNS = nonSingular.has(e.a.key());
    const bNS = nonSingular.has(e.b.key());
    if (aNS && !bNS) force(i, 0, 'rule 1');
    else if (bNS && !aNS) force(i, 1, 'rule 1');
  });

  // fixed anatomy: cell-only kinds point into their central node,
  // intermediate-only kinds point out; either-role halves couple their legs
  for (const f of faces) {
    if (f.fixedCentral === null) continue;
    const n = f.verts.length;
    const c = f.fixedCentral;
    const eIn = f.edgeIdx[(c - 1 + n) % n]!; // edge arriving at c in traversal
    const eOut = f.edgeIdx[c]!; // edge leaving c in traversal
    const ck = f.verts[c]!.key();
    const cellOnly = f.roles.includes('cell') && !f.roles.includes('intermediate');
    const intOnly = f.roles.includes('intermediate') && !f.roles.includes('cell');
    if (cellOnly) {
      forceToward(eIn, ck, true, `${f.kind} cell-only`);
      forceToward(eOut, ck, true, `${f.kind} cell-only`);
    } else if (intOnly) {
      forceToward(eIn, ck, false, `${f.kind} intermediate-only`);
      forceToward(eOut, ck, false, `${f.kind} intermediate-only`);
    } else {
      // both-role halves: legs point into c together or out together
      const into = (ei: number): 0 | 1 => {
        const e = edges[ei]!;
        return (e.b.key() === ck ? 0 : 1) as 0 | 1;
      };
      // value(eIn) == into(eIn) ⟺ value(eOut) == into(eOut)
      const rel = (into(eIn) ^ into(eOut)) as number;
      union(eIn, eOut, rel);
    }
  }

  // Rule 2 (alternative form): orbits without centre-internal edges direct
  // their centre-touching edges into the centre
  if (centreSet.size > 0) {
    const orbitHasCentreInternal = new Map<number, boolean>();
    edges.forEach((e, i) => {
      if (excluded[i]) return;
      const [r] = find(i);
      if (centreSet.has(e.a.key()) && centreSet.has(e.b.key())) orbitHasCentreInternal.set(r, true);
    });
    edges.forEach((e, i) => {
      if (excluded[i]) return;
      const aC = centreSet.has(e.a.key());
      const bC = centreSet.has(e.b.key());
      if (aC === bC) return;
      const [r] = find(i);
      if (orbitHasCentreInternal.get(r)) return;
      forceToward(i, aC ? e.a.key() : e.b.key(), true, 'rule 2');
    });
  }

  /* ---------- enumerate free orbits ---------- */
  const rootsInUse = new Set<number>();
  edges.forEach((_, i) => {
    if (!excluded[i]) rootsInUse.add(find(i)[0]);
  });
  const freeRoots = [...rootsInUse].filter((r) => !forced.has(r)).sort((a, b) => a - b);
  const maxFree = opts.maxFreeOrbits ?? 16;
  if (freeRoots.length > maxFree) {
    throw new Error(`solver: ${freeRoots.length} free orbits exceed the cap of ${maxFree}`);
  }

  // node indexing
  const nodeIdx = new Map<string, number>();
  const nodePts: Pt[] = [];
  for (const e of edges) {
    for (const p of [e.a, e.b]) {
      if (!nodeIdx.has(p.key())) {
        nodeIdx.set(p.key(), nodePts.length);
        nodePts.push(p);
      }
    }
  }
  const nodeCount = nodePts.length;

  // nodes touching a front joint keep free curved sides — the fig 3.12
  // exemption: they may be sinks
  const nodeHasFront = new Set<string>();
  edges.forEach((e, i) => {
    if (excluded[i]) {
      nodeHasFront.add(e.a.key());
      nodeHasFront.add(e.b.key());
    }
  });

  const solutions: TierSolution[] = [];
  const seenSignatures = new Set<string>();
  const total = 1 << freeRoots.length;
  const rejected = { heights: 0, sources: 0, sinks: 0, faceReading: 0 };

  for (let mask = 0; mask < total; mask++) {
    const choices = freeRoots.map((_, bit) => ((mask >> bit) & 1) === 1);
    const rootValue = new Map<number, number>(forced);
    freeRoots.forEach((r, bit) => rootValue.set(r, choices[bit] ? 1 : 0));

    // resolve directions: dir true = a→b (excluded edges carry none)
    const dir: boolean[] = edges.map((_, i) => {
      if (excluded[i]) return true;
      const [r, p] = find(i);
      return ((rootValue.get(r)! ^ p) as number) === 0;
    });

    // heights: monotone raises until stable (A-3.3); divergence = invalid
    const h = new Array<number>(nodeCount).fill(0);
    const arrows: Array<[number, number]> = [];
    edges.forEach((e, i) => {
      if (excluded[i]) return;
      const t = nodeIdx.get(dir[i] ? e.a.key() : e.b.key())!;
      const hd = nodeIdx.get(dir[i] ? e.b.key() : e.a.key())!;
      arrows.push([t, hd]);
    });
    let ok = true;
    for (let sweep = 0; ; sweep++) {
      let changed = false;
      for (const [t, hd] of arrows) {
        if (h[hd]! < h[t]! + 1) {
          h[hd] = h[t]! + 1;
          changed = true;
        }
        if (h[t]! < h[hd]! - 1) {
          h[t] = h[hd]! - 1;
          changed = true;
        }
      }
      if (!changed) break;
      if (sweep > 2 * nodeCount || Math.max(...h) > nodeCount) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      rejected.heights++;
      continue;
    }

    // Rule 4: interior sources forbidden; interior sinks only as the single
    // apex of a dome (no centre hole)
    const outDeg = new Array<number>(nodeCount).fill(0);
    const inDeg = new Array<number>(nodeCount).fill(0);
    for (const [t, hd] of arrows) {
      outDeg[t]!++;
      inDeg[hd]!++;
    }
    let sinks = 0;
    let bad = false;
    for (let i = 0; i < nodeCount; i++) {
      const key = nodePts[i]!.key();
      if (boundarySet.has(key)) continue;
      if (inDeg[i] === 0) {
        bad = true;
        break;
      }
      if (outDeg[i] === 0 && !nodeHasFront.has(key)) sinks++;
    }
    if (bad) {
      rejected.sources++;
      continue;
    }
    if (centreSet.size > 0 ? sinks > 0 : sinks > 1) {
      rejected.sinks++;
      continue;
    }

    // read faces
    const solved: SolvedFace[] = [];
    let valid = true;
    for (const f of faces) {
      const n = f.verts.length;
      const isInto = (side: number, vertex: number): boolean => {
        const e = edges[f.edgeIdx[side]!]!;
        const headKey = dir[f.edgeIdx[side]!] ? e.b.key() : e.a.key();
        return headKey === f.verts[vertex]!.key();
      };
      let inCorner = -1;
      let outCorner = -1;
      const corners = f.fixedCentral !== null ? [f.fixedCentral] : [...Array(n).keys()];
      for (const c of corners) {
        const prev = (c - 1 + n) % n;
        const into1 = isInto(prev, c);
        const into2 = isInto(c, c);
        if (into1 && into2) inCorner = c;
        if (!into1 && !into2) outCorner = c;
      }
      const cellLegal = (c: number) =>
        f.roles.includes('cell') && (f.kind !== 'rhombus' || interiorAngleUnits(f.verts, c) === 6);
      const intLegal = () => f.roles.includes('intermediate');
      if (inCorner >= 0 && cellLegal(inCorner)) {
        const tier = h[nodeIdx.get(f.verts[inCorner]!.key())!]!;
        solved.push({ placedIndex: f.placedIndex, type: 'cell', centralNode: inCorner, tier });
      } else if (outCorner >= 0 && intLegal()) {
        const tier = h[nodeIdx.get(f.verts[outCorner]!.key())!]! + 1;
        solved.push({ placedIndex: f.placedIndex, type: 'intermediate', centralNode: outCorner, tier });
      } else {
        valid = false;
        break;
      }
    }
    if (!valid) {
      rejected.faceReading++;
      continue;
    }

    const tierCount = Math.max(...solved.map((s) => s.tier));
    const signature = solved.map((s) => `${s.type[0]}${s.centralNode}t${s.tier}`).join('|');
    if (seenSignatures.has(signature)) continue;
    seenSignatures.add(signature);

    const directions = new Map<string, boolean>();
    edges.forEach((e, i) => {
      if (!excluded[i]) directions.set(e.key, dir[i]!);
    });
    const heights = new Map<string, number>();
    nodePts.forEach((p, i) => heights.set(p.key(), h[i]!));
    const graphReach = Math.max(...h);
    solutions.push({ tierCount, graphReach, faces: solved, choices, directions, heights });
  }

  solutions.sort((a, b) => a.tierCount - b.tierCount);
  return {
    solutions,
    freeOrbits: freeRoots.length,
    candidatesTried: total,
    conflicts,
    wallNodes: wallSet.size,
    centreNodes: centreSet.size,
    rejected,
  };
}
