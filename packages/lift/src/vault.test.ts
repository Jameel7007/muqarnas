import { describe, expect, it } from 'vitest';
import { Iso, gridVaultFull, takhtPlateFull } from '@muqarnas/plan';
import { manifoldReport, projectedTriangleArea } from './mesh.js';
import { enumerateAssignments } from './solver.js';
import { liftVault } from './curved.js';

const PLATE_SYMMETRIES = [0, 2, 4, 6].flatMap((k) => [
  Iso.rotation(k),
  Iso.reflection(2).then(Iso.rotation(k)),
]);

describe('the demo grid vault, solved and lifted', () => {
  const plan = gridVaultFull();
  const report = enumerateAssignments(plan);
  const twoTier = report.solutions.find((s) => s.tierCount === 2)!;
  const { mesh, tris } = liftVault(plan, twoTier.faces);

  it('is closed to the springing, walls meeting only along legitimate seams', () => {
    const r = manifoldReport(mesh);
    const isVertical = (a: number, bb: number) => {
      const dx = mesh.positions[a * 3]! - mesh.positions[bb * 3]!;
      const dy = mesh.positions[a * 3 + 1]! - mesh.positions[bb * 3 + 1]!;
      return Math.hypot(dx, dy) < 1e-9;
    };
    const atFacetHeight = (a: number) => {
      const z = mesh.positions[a * 3 + 2]!;
      const frac = ((z % 2) + 2) % 2;
      return Math.abs(frac - (2 - 0.6 * Math.sqrt(3))) < 1e-6;
    };
    for (const [a, b] of r.nonManifoldEdges) {
      expect(isVertical(a, b) || (atFacetHeight(a) && atFacetHeight(b))).toBe(true);
    }
    for (const [a, b] of r.boundaryEdges) {
      const spring =
        Math.abs(mesh.positions[a * 3 + 2]!) < 1e-9 && Math.abs(mesh.positions[b * 3 + 2]!) < 1e-9;
      expect(spring || isVertical(a, b)).toBe(true);
    }
  });

  it('PROJECTION IDENTITY: roofs and panels cover the full 4×4 bay', () => {
    let roof = 0;
    tris.forEach((t, i) => {
      const a = projectedTriangleArea(mesh, i);
      if (t.role === 'roof') roof += Math.abs(a);
      else expect(Math.abs(a)).toBeLessThan(1e-12);
    });
    expect(roof).toBeCloseTo(16, 9);
  });
});

describe('THE TAKHT-I SULAYMĀN VAULT IN 3D', () => {
  const plan = takhtPlateFull();
  const report = enumerateAssignments(plan, { maxFreeOrbits: 20, symmetries: PLATE_SYMMETRIES });
  // the reading whose crown-rim reach matches the published regular-centre count
  const solution = report.solutions.find((s) => s.graphReach === 17) ?? report.solutions[0]!;
  const openCentre = (a: { toNumbers(): [number, number] }, b: { toNumbers(): [number, number] }) => {
    const [ax, ay] = a.toNumbers();
    const [bx, by] = b.toNumbers();
    return !(Math.hypot(ax, ay) < 4.3 && Math.hypot(bx, by) < 4.3);
  };
  const { mesh, tris } = liftVault(plan, solution.faces, {
    arcSegments: 6,
    rampSegments: 3,
    closeBoundary: openCentre,
  });

  it('stands: closed but for the springing, the crown rim, and legitimate wall seams', () => {
    // A vault's walls meet along vertical spine lines (≥3 planes on one
    // edge) and back-to-back cells share double walls whose top seams sit
    // exactly at facet height — real masonry, not mesh defects. Everything
    // else must be closed.
    const r = manifoldReport(mesh);
    const isVertical = (a: number, bb: number) => {
      const dx = mesh.positions[a * 3]! - mesh.positions[bb * 3]!;
      const dy = mesh.positions[a * 3 + 1]! - mesh.positions[bb * 3 + 1]!;
      return Math.hypot(dx, dy) < 1e-9;
    };
    const atFacetHeight = (a: number) => {
      const z = mesh.positions[a * 3 + 2]!;
      const frac = ((z % 2) + 2) % 2;
      return Math.abs(frac - (2 - 0.6 * Math.sqrt(3))) < 1e-6;
    };
    for (const [a, bb] of r.nonManifoldEdges) {
      expect(isVertical(a, bb) || (atFacetHeight(a) && atFacetHeight(bb))).toBe(true);
    }
    expect(r.nonManifoldEdges.length).toBeLessThan(60);
    for (const [a, bb] of r.boundaryEdges) {
      const za = mesh.positions[a * 3 + 2]!;
      const zb = mesh.positions[bb * 3 + 2]!;
      const ra = Math.hypot(mesh.positions[a * 3]!, mesh.positions[a * 3 + 1]!);
      const rb = Math.hypot(mesh.positions[bb * 3]!, mesh.positions[bb * 3 + 1]!);
      const atSpringing = Math.abs(za) < 1e-9 && Math.abs(zb) < 1e-9;
      const atCrownRim = ra < 4.3 && rb < 4.3;
      expect(
        atSpringing || atCrownRim || isVertical(a, bb),
        `boundary edge at z=${za.toFixed(2)},${zb.toFixed(2)} r=${ra.toFixed(2)},${rb.toFixed(2)}`,
      ).toBe(true);
    }
  });

  it('PROJECTION IDENTITY for the whole vault: 4·(61 + 47√2) + 4 diamonds', () => {
    let roof = 0;
    tris.forEach((t, i) => {
      const a = projectedTriangleArea(mesh, i);
      if (t.role === 'roof') roof += Math.abs(a);
      else expect(Math.abs(a)).toBeLessThan(1e-9);
    });
    expect(roof).toBeCloseTo(4 * (61 + 47 * Math.SQRT2) + 4, 6);
  });

  it('reaches its full height: max z = tierCount · 2', () => {
    let zMax = -Infinity;
    for (let i = 2; i < mesh.positions.length; i += 3) zMax = Math.max(zMax, mesh.positions[i]!);
    expect(zMax).toBeCloseTo(solution.tierCount * 2, 9);
  });
});
