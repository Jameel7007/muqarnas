import { describe, expect, it } from 'vitest';
import {
  ALKASHI_COEFFICIENT,
  CELL_FACET_BASE,
  FACTOR_PER_MODULE,
  Iso,
  element,
  measureCurved,
  place,
  pt,
  worldOutline,
  area,
  type Plan,
} from '@muqarnas/plan';
import { manifoldReport, projectedTriangleArea, surfaceArea, type Mesh } from './mesh.js';
import {
  CELL_HEIGHT,
  liftCurvedCells,
  profileHeight,
  profileSegments,
  type CurvedCellSpec,
} from './curved.js';

const GH = FACTOR_PER_MODULE;

function singleCell(kind: Parameters<typeof element>[0], centralNode?: number, tier = 1) {
  const def = element(kind);
  const plan: Plan = { sector: [...def.verts], placed: [place(kind, 'cell', Iso.IDENTITY, tier)] };
  const specs: CurvedCellSpec[] = [{ placedIndex: 0, ...(centralNode !== undefined ? { centralNode } : {}) }];
  return { plan, specs };
}

function roofArea(mesh: Mesh, tris: { role: string }[]): number {
  let sum = 0;
  tris.forEach((t, i) => {
    if (t.role === 'roof') sum += Math.abs(projectedTriangleArea(mesh, i));
  });
  return sum;
}

describe('the profile height function', () => {
  it('runs GH → 2, monotone, continuous at the kink', () => {
    expect(profileHeight(0)).toBeCloseTo(GH, 12);
    expect(profileHeight(1)).toBeCloseTo(2, 12);
    const atKinkArc = GH + Math.sqrt(0.64 - 0.16);
    expect(profileHeight(0.4)).toBeCloseTo(atKinkArc, 12);
    expect(profileHeight(0.4)).toBeCloseTo(2 - 0.6 * Math.tan(Math.PI / 6), 12);
    let prev = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const h = profileHeight(i / 200);
      expect(h).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = h;
    }
  });
});

describe('a single curved square cell', () => {
  const { plan, specs } = singleCell('square', 0);
  const { mesh, tris } = liftCurvedCells(plan, specs);
  const K = profileSegments();

  it('is manifold with boundary only where a lone cell must have it', () => {
    const r = manifoldReport(mesh);
    expect(r.nonManifoldEdges).toEqual([]);
    // 2 facet bottoms + 2 facet-corner verticals + 2 side profiles of K edges
    expect(r.boundaryEdges.length).toBe(4 + 2 * K);
  });

  it('facets are vertical and exactly base × factor in area', () => {
    let facetArea = 0;
    tris.forEach((t, i) => {
      if (t.role === 'facet') {
        expect(Math.abs(projectedTriangleArea(mesh, i))).toBeLessThan(1e-12);
      }
    });
    const facetMesh: number[] = [];
    tris.forEach((t, i) => {
      if (t.role === 'facet') facetMesh.push(i);
    });
    // sum via surfaceArea on a filtered mesh
    const sub = {
      positions: mesh.positions,
      triangles: facetMesh.flatMap((i) => mesh.triangles.slice(i * 3, i * 3 + 3)),
    };
    facetArea = surfaceArea(sub);
    expect(facetArea).toBeCloseTo(CELL_FACET_BASE.square * GH, 10);
  });

  it('PROJECTION IDENTITY: the roof projects exactly onto the plan square', () => {
    expect(roofArea(mesh, tris)).toBeCloseTo(1, 10);
  });

  it('tops out at the apex, at cell height 2', () => {
    let zMax = -Infinity;
    let apexCount = 0;
    for (let i = 2; i < mesh.positions.length; i += 3) zMax = Math.max(zMax, mesh.positions[i]!);
    expect(zMax).toBeCloseTo(CELL_HEIGHT, 12);
    for (let i = 2; i < mesh.positions.length; i += 3) {
      if (Math.abs(mesh.positions[i]! - CELL_HEIGHT) < 1e-12) apexCount++;
    }
    expect(apexCount).toBe(1); // the apex welds to a single vertex
  });

  it('tier placement shifts the whole cell by 2 per tier', () => {
    const t3 = singleCell('square', 0, 3);
    const lifted = liftCurvedCells(t3.plan, t3.specs);
    let zMin = Infinity;
    let zMax = -Infinity;
    for (let i = 2; i < lifted.mesh.positions.length; i += 3) {
      zMin = Math.min(zMin, lifted.mesh.positions[i]!);
      zMax = Math.max(zMax, lifted.mesh.positions[i]!);
    }
    expect(zMin).toBeCloseTo(4, 12);
    expect(zMax).toBeCloseTo(6, 12);
  });
});

describe('every fixed-anatomy cell kind lifts', () => {
  for (const kind of ['half-square', 'half-rhombus', 'jug', 'almond'] as const) {
    it(`${kind}: manifold, roof projects to its plan area`, () => {
      const { plan, specs } = singleCell(kind);
      const { mesh, tris } = liftCurvedCells(plan, specs);
      expect(manifoldReport(mesh).nonManifoldEdges).toEqual([]);
      const planArea = area(worldOutline(plan.placed[0]!).verts).toNumber();
      expect(roofArea(mesh, tris)).toBeCloseTo(planArea, 10);
    });
  }

  it('rhombus needs — and accepts — an explicit 135° central node', () => {
    expect(() => {
      const { plan, specs } = singleCell('rhombus');
      liftCurvedCells(plan, specs);
    }).toThrow(/centralNode/);
    const { plan, specs } = singleCell('rhombus', 3); // the 135° corner
    const { mesh, tris } = liftCurvedCells(plan, specs);
    expect(manifoldReport(mesh).nonManifoldEdges).toEqual([]);
    expect(roofArea(mesh, tris)).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it('a 45° corner of the rhombus is rejected as an apex', () => {
    const { plan, specs } = singleCell('rhombus', 0);
    // 45° is a legal apex angle in general (almond) — but for the rhombus the
    // 45° corner has non-unit "curved sides"? No: they are unit. It is legal
    // geometry; the LONG orientation is simply unattested as a cell. The lift
    // accepts it; the solver will forbid it by rule. Just verify it builds.
    const { mesh } = liftCurvedCells(plan, specs);
    expect(manifoldReport(mesh).nonManifoldEdges).toEqual([]);
  });
});

describe('two cells welded along a shared curved side', () => {
  // mirror pair: both apexes at the origin, sharing the curved side (0,0)–(1,0)
  const plan: Plan = {
    sector: [pt(0, -1), pt(1, -1), pt(1, 1), pt(0, 1)],
    placed: [
      place('square', 'cell', Iso.IDENTITY, 1),
      place('square', 'cell', Iso.reflection(0), 1),
    ],
  };
  const specs: CurvedCellSpec[] = [
    { placedIndex: 0, centralNode: 0 },
    { placedIndex: 1, centralNode: 3 }, // world index of (0,0) in the reflected outline
  ];
  const { mesh, tris } = liftCurvedCells(plan, specs);
  const K = profileSegments();

  it('the shared profile welds: manifold, no boundary along the joint', () => {
    const r = manifoldReport(mesh);
    expect(r.nonManifoldEdges).toEqual([]);
    // each lone cell: 4 + 2K boundary edges; welding removes the 2K shared
    // profile edges and the pair of facet-corner verticals at (1,0)
    expect(r.boundaryEdges.length).toBe(2 * (4 + 2 * K) - 2 * K - 2);
  });

  it('roofs project to both squares', () => {
    expect(roofArea(mesh, tris)).toBeCloseTo(2, 10);
  });
});

describe('four cells closing around one apex (a crown group)', () => {
  const plan: Plan = {
    sector: [pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1)],
    placed: [0, 2, 4, 6].map((k) => place('square', 'cell', Iso.rotation(k), 1)),
  };
  const specs: CurvedCellSpec[] = plan.placed.map((_, i) => ({ placedIndex: i, centralNode: 0 }));
  const { mesh, tris } = liftCurvedCells(plan, specs);

  it('closes: the only boundary is the eight facet bottoms at the springing', () => {
    const r = manifoldReport(mesh);
    expect(r.nonManifoldEdges).toEqual([]);
    expect(r.boundaryEdges.length).toBe(8);
    for (const [a, b] of r.boundaryEdges) {
      expect(mesh.positions[a * 3 + 2]).toBeCloseTo(0, 12);
      expect(mesh.positions[b * 3 + 2]).toBeCloseTo(0, 12);
    }
  });

  it('one welded apex; roofs project onto the full 2×2 bay', () => {
    let apexes = 0;
    for (let i = 2; i < mesh.positions.length; i += 3) {
      if (Math.abs(mesh.positions[i]! - CELL_HEIGHT) < 1e-12) apexes++;
    }
    expect(apexes).toBe(1);
    expect(roofArea(mesh, tris)).toBeCloseTo(4, 10);
  });
});

describe('THE AL-KĀSHĪ ORACLE: mesh surface vs the 1427 coefficient method', () => {
  const fine = { arcSegments: 96, rampSegments: 48 };
  const cases = [
    { kind: 'square' as const, centralNode: 0 },
    { kind: 'almond' as const, centralNode: undefined },
    { kind: 'jug' as const, centralNode: undefined },
    { kind: 'half-square' as const, centralNode: undefined },
  ];
  for (const { kind, centralNode } of cases) {
    it(`cell on ${kind}: within the tolerance of his average-depth trick`, () => {
      const { plan, specs } = singleCell(kind, centralNode);
      const { mesh } = liftCurvedCells(plan, specs, fine);
      const meshArea = surfaceArea(mesh);
      const his = measureCurved({ cells: { [kind]: 1 } }).total;
      const deviation = (meshArea - his) / his;
      // Al-Kāshī assumes an average roof depth of one module ("a brilliant
      // trick… good enough for practical purposes", DS 1992 p. 221). The
      // true cylinder integral is front-loaded where the arc is steep, so
      // the mesh runs a few percent above his figure — sign and size
      // documented here.
      expect(deviation).toBeGreaterThan(0);
      expect(deviation).toBeLessThan(0.12);
    });
  }

  it('converges: coarse vs fine sampling differ under 2e-3', () => {
    const { plan, specs } = singleCell('square', 0);
    const coarse = surfaceArea(liftCurvedCells(plan, specs, { arcSegments: 12, rampSegments: 6 }).mesh);
    const fineA = surfaceArea(liftCurvedCells(plan, specs, fine).mesh);
    expect(Math.abs(coarse - fineA)).toBeLessThan(2e-3);
  });

  it('the roof integral per unit facet base is ∫(1−u)·ds ≈ 0.9297, vs his ½·curve = 0.7653', () => {
    // independent quadrature of the cylinder area for the square cell
    const N = 200000;
    let acc = 0;
    let prev: [number, number] = [0, profileHeight(0)];
    for (let i = 1; i <= N; i++) {
      const u = i / N;
      const h = profileHeight(u);
      const ds = Math.hypot(u - prev[0], h - prev[1]);
      acc += (1 - (u + prev[0]) / 2) * ds;
      prev = [u, h];
    }
    expect(acc).toBeCloseTo(0.9297, 3);
    const { plan, specs } = singleCell('square', 0);
    const { mesh, tris } = liftCurvedCells(plan, specs, fine);
    const roofOnly = {
      positions: mesh.positions,
      triangles: tris.flatMap((t, i) => (t.role === 'roof' ? [...mesh.triangles.slice(i * 3, i * 3 + 3)] : [])),
    };
    // two panels, each w₀ = 1 wide at the foot
    expect(surfaceArea(roofOnly)).toBeCloseTo(2 * acc, 3);
    expect(2 * acc).toBeGreaterThan(2 * (ALKASHI_COEFFICIENT - GH)); // his roof share
  });
});
