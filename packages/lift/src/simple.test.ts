import { describe, expect, it } from 'vitest';
import { area, gridVaultFull, worldOutline } from '@muqarnas/plan';
import { manifoldReport, projectedTriangleArea, surfaceArea } from './mesh.js';
import { gridVaultLifted } from './demo.js';
import { DEFAULT_SIMPLE_PARAMS } from './simple.js';

const { tierHeight: H, facetHeight: F } = DEFAULT_SIMPLE_PARAMS;

describe('simple lift of the demo vault (two tiers, 24 cells)', () => {
  const { vault, plan } = gridVaultLifted();
  const { mesh, tris } = vault;

  it('is watertight: no non-manifold edges, boundary only at the springing', () => {
    const report = manifoldReport(mesh);
    expect(report.nonManifoldEdges).toEqual([]);
    for (const [a, b] of report.boundaryEdges) {
      expect(mesh.positions[a * 3 + 2]).toBeCloseTo(0, 12);
      expect(mesh.positions[b * 3 + 2]).toBeCloseTo(0, 12);
    }
    // the springing perimeter of the 4×4 plan: sixteen unit facet bottoms
    expect(report.boundaryEdges.length).toBe(16);
  });

  it('tier continuity is structural: tier 1 top welds to tier 2 base', () => {
    // If the joint did not weld, its edges would appear as boundary at z = H.
    const report = manifoldReport(mesh);
    const atJoint = report.boundaryEdges.filter(
      ([a, b]) =>
        Math.abs(mesh.positions[a * 3 + 2]! - H) < 1e-12 &&
        Math.abs(mesh.positions[b * 3 + 2]! - H) < 1e-12,
    );
    expect(atJoint).toEqual([]);
  });

  it('PROJECTION IDENTITY: each roof projects exactly onto its plan cell; facets project to nothing', () => {
    const roofAreaByCell = new Map<number, number>();
    tris.forEach((t, i) => {
      const a = projectedTriangleArea(mesh, i);
      if (t.role === 'facet') {
        expect(Math.abs(a)).toBeLessThan(1e-12); // vertical: no footprint
      } else {
        roofAreaByCell.set(t.cell, (roofAreaByCell.get(t.cell) ?? 0) + a);
      }
    });
    plan.placed.forEach((p, i) => {
      const planArea = area(worldOutline(p).verts).toNumber();
      expect(roofAreaByCell.get(i)!, `cell ${i} (${p.def.kind})`).toBeCloseTo(planArea, 10);
    });
    const total = [...roofAreaByCell.values()].reduce((s, x) => s + x, 0);
    expect(total).toBeCloseTo(16, 10); // the full 4×4 sector — lossless top view
  });

  it('closes at a single crown apex', () => {
    const apexes: number[] = [];
    for (let i = 0; i < mesh.positions.length; i += 3) {
      if (Math.abs(mesh.positions[i + 2]! - 2 * H) < 1e-12) apexes.push(i / 3);
    }
    expect(apexes.length).toBe(1);
  });

  it('surface area matches the closed-form roll-up (a hand oracle until al-Kāshī’s)', () => {
    const slant = Math.hypot(1, H - F);
    const expected =
      24 * F + // twenty-four unit facets: sixteen in tier 1, eight at the crown
      8 * slant + // eight square-cell roofs: unit width × slant depth
      16 * (slant / 2); // sixteen triangular roofs (ring corners + crown)
    expect(surfaceArea(mesh)).toBeCloseTo(expected, 10);
  });

  it('rejects intermediates and double lifts', () => {
    const plan2 = gridVaultFull();
    expect(() =>
      gridVaultLifted({ tierHeight: 1, facetHeight: 1.5 }),
    ).toThrow(/facetHeight/);
    expect(plan2.placed.length).toBe(24);
  });
});
