import { Q2 } from './q2.js';
import { Iso, Pt, area, onSegmentStrict, dot2, signedArea2 } from './geom.js';
import { element, type ElementDef, type ElementKind, type Role } from './elements.js';

/**
 * A plan is a non-overlapping, gap-free tiling of a sector by placed
 * elements. The hard invariant — exact cover — is what makes the plan a
 * lossless top view of the vault, and it is checked with exact arithmetic:
 * no epsilons anywhere.
 */

export interface PlacedElement {
  readonly def: ElementDef;
  readonly role: Role;
  readonly iso: Iso;
  /** Optional tier hint for inspection/coloring; authoritative assignment lives in the lift. */
  readonly tier?: number;
}

export interface Plan {
  /** CCW polygon bounding the tiled region. */
  readonly sector: readonly Pt[];
  readonly placed: readonly PlacedElement[];
}

/** Place an element; the role must be one the element may legally serve. */
export function place(
  kind: ElementKind | ElementDef,
  role: Role,
  iso: Iso = Iso.IDENTITY,
  tier?: number,
): PlacedElement {
  const def = typeof kind === 'string' ? element(kind) : kind;
  if (!def.roles.includes(role)) {
    throw new Error(
      `role violation: ${def.kind} may not serve as ${role} (allowed: ${def.roles.join(', ')})`,
    );
  }
  return tier === undefined ? { def, role, iso } : { def, role, iso, tier };
}

/**
 * Where canonical edge index i lands in the CCW world outline. Identity for
 * direct placements; reflections reverse winding, sending edge i to n−2−i.
 */
export function worldEdgeIndex(p: PlacedElement, edgeIndex: number): number {
  const n = p.def.verts.length;
  if (p.iso.isDirect()) return edgeIndex;
  return (((n - 2 - edgeIndex) % n) + n) % n;
}

/** World-space outline, CCW regardless of whether the placement reflects. */
export function worldOutline(p: PlacedElement): { verts: Pt[]; curvedEdges: number[] } {
  const verts = p.def.verts.map((v) => p.iso.apply(v));
  if (p.iso.isDirect()) return { verts, curvedEdges: [...p.def.curvedEdges] };
  // Reflection reverses winding; restore CCW and remap edge indices.
  const reversed = [...verts].reverse();
  const curved = p.def.curvedEdges.map((i) => worldEdgeIndex(p, i));
  return { verts: reversed, curvedEdges: curved };
}

export interface ValidationIssue {
  readonly kind: 'area' | 'edge' | 'winding';
  readonly message: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly sectorArea: Q2;
  readonly tiledArea: Q2;
}

function fmt(p: Pt): string {
  const [x, y] = p.toNumbers();
  return `(${x.toFixed(4)}, ${y.toFixed(4)})`;
}

/**
 * Exact-cover check: the placed elements must tile the sector with zero
 * overlap and zero gap.
 *
 * 1. Σ element areas = sector area (exact equality).
 * 2. Chain cancellation: split every element edge and every sector edge at
 *    all vertices lying on it (handles T-junctions, which the alphabet
 *    permits: √2 = 1 + (√2−1) makes collinear part-sharing possible), then
 *    require every interior sub-edge to be traversed equally in both
 *    directions and the leftover to equal the sector boundary exactly.
 */
export function validatePlan(plan: Plan): ValidationResult {
  const issues: ValidationIssue[] = [];

  const sector = [...plan.sector];
  if (signedArea2(sector).sign() !== 1) {
    issues.push({ kind: 'winding', message: 'sector polygon must be CCW and non-degenerate' });
  }

  const polys = plan.placed.map((p) => worldOutline(p).verts);

  // 1. Exact area equality.
  const sectorArea = area(sector);
  let tiledArea = Q2.ZERO;
  for (const poly of polys) tiledArea = tiledArea.add(area(poly));
  if (!sectorArea.eq(tiledArea)) {
    issues.push({
      kind: 'area',
      message: `area mismatch: sector ${sectorArea} (${sectorArea.toNumber().toFixed(6)}) vs tiled ${tiledArea} (${tiledArea.toNumber().toFixed(6)})`,
    });
  }

  // 2. Chain cancellation with T-junction splitting.
  const vertexByKey = new Map<string, Pt>();
  const addVert = (p: Pt) => {
    const k = p.key();
    if (!vertexByKey.has(k)) vertexByKey.set(k, p);
  };
  for (const poly of polys) for (const v of poly) addVert(v);
  for (const v of sector) addVert(v);
  const allVerts = [...vertexByKey.values()];

  /** Split edge a→b at every known vertex strictly inside it; returns directed sub-edges. */
  const splitEdge = (a: Pt, b: Pt): Array<[Pt, Pt]> => {
    const dir = b.sub(a);
    const inside = allVerts
      .filter((v) => onSegmentStrict(v, a, b))
      .sort((u, v) => dot2(u.sub(a), dir).cmp(dot2(v.sub(a), dir)));
    const stops = [a, ...inside, b];
    const out: Array<[Pt, Pt]> = [];
    for (let i = 0; i + 1 < stops.length; i++) out.push([stops[i]!, stops[i + 1]!]);
    return out;
  };

  // net counts of directed sub-edges: elements add, sector boundary subtracts.
  const net = new Map<string, { a: Pt; b: Pt; n: number }>();
  const bump = (a: Pt, b: Pt, by: number) => {
    const k = `${a.key()}>${b.key()}`;
    const cur = net.get(k);
    if (cur) cur.n += by;
    else net.set(k, { a, b, n: by });
  };
  const walkPoly = (poly: readonly Pt[], by: number) => {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      for (const [sa, sb] of splitEdge(a, b)) bump(sa, sb, by);
    }
  };
  for (const poly of polys) walkPoly(poly, +1);
  walkPoly(sector, -1);

  // After removing the sector boundary, every sub-edge must be matched by its
  // reverse (each interior edge is walked once in each direction).
  const seen = new Set<string>();
  for (const [k, e] of net) {
    if (seen.has(k)) continue;
    const rk = `${e.b.key()}>${e.a.key()}`;
    seen.add(k);
    seen.add(rk);
    const m = e.n;
    const n = net.get(rk)?.n ?? 0;
    if (m !== n) {
      const excess = m - n;
      issues.push({
        kind: 'edge',
        message:
          `${excess > 0 ? 'overlap or stray edge' : 'gap or missing edge'} along ` +
          `${fmt(e.a)} → ${fmt(e.b)} (imbalance ${excess})`,
      });
    }
  }

  return { ok: issues.length === 0, issues, sectorArea, tiledArea };
}

/**
 * Kaleidoscope: the symmetries of a plan wedge. Rotations must be multiples
 * of 45° and mirror axes multiples of 22.5° — the grid's own symmetries —
 * so unfolding never leaves ℚ(√2).
 */
export function dihedralIsos(rotations: 1 | 2 | 4 | 8, mirrorAxisUnits: number | null = null): Iso[] {
  const step = 8 / rotations;
  const out: Iso[] = [];
  for (let k = 0; k < rotations; k++) {
    const r = Iso.rotation(k * step);
    out.push(r);
    if (mirrorAxisUnits !== null) {
      if (!Number.isInteger(mirrorAxisUnits)) throw new Error('mirror axis must be integer units of 22.5°');
      out.push(Iso.reflection(mirrorAxisUnits).then(r));
    }
  }
  return out;
}

/** Apply a set of isometries to a wedge plan, producing the full plan over `fullSector`. */
export function unfold(wedge: Plan, isos: readonly Iso[], fullSector: readonly Pt[]): Plan {
  const placed: PlacedElement[] = [];
  for (const iso of isos) {
    for (const p of wedge.placed) {
      placed.push({ ...p, iso: p.iso.then(iso) });
    }
  }
  return { sector: fullSector, placed };
}
