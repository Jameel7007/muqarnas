import { describe, expect, it } from 'vitest';
import { Iso, place, pt, type Plan } from '@muqarnas/plan';
import { liftCurvedCells, liftVault, type CurvedCellSpec } from '@muqarnas/lift';
import { bakeVertexAO } from './ao.js';
import { toDisplayGeometry, vaultToGeometry, withPaintAttribute } from './geometry.js';

describe('vault → three geometry', () => {
  const plan: Plan = {
    sector: [pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)],
    placed: [place('square', 'cell', Iso.IDENTITY, 1)],
  };
  const specs: CurvedCellSpec[] = [{ placedIndex: 0, centralNode: 0 }];
  const vault = liftCurvedCells(plan, specs);
  const g = vaultToGeometry(vault);

  it('carries positions, index, unit normals, and an open ao attribute', () => {
    expect(g.getAttribute('position').count).toBe(vault.mesh.positions.length / 3);
    expect(g.getIndex()!.count).toBe(vault.mesh.triangles.length);
    const n = g.getAttribute('normal');
    for (let i = 0; i < n.count; i++) {
      const len = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
      expect(len).toBeGreaterThan(0.99);
      expect(len).toBeLessThan(1.01);
    }
    const ao = g.getAttribute('ao');
    for (let i = 0; i < ao.count; i++) expect(ao.getX(i)).toBe(1);
  });

  it('display geometry is non-indexed with creased normals and the ao carried', () => {
    const d = toDisplayGeometry(g);
    expect(d.getIndex()).toBeNull();
    expect(d.getAttribute('position').count).toBe(vault.mesh.triangles.length);
    expect(d.getAttribute('ao').count).toBe(d.getAttribute('position').count);
    expect(d.getAttribute('normal').count).toBe(d.getAttribute('position').count);
  });
});

describe('baked ambient occlusion (the lighting experiment, measured)', () => {
  // the crown group: four cells closing around one apex — real concavities
  const plan: Plan = {
    sector: [pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1)],
    placed: [0, 2, 4, 6].map((k) => place('square', 'cell', Iso.rotation(k), 1)),
  };
  const solved = plan.placed.map((_, i) => ({
    placedIndex: i,
    type: 'cell' as const,
    centralNode: 0,
    tier: 1,
  }));
  const vault = liftVault(plan, solved, { closeBoundary: () => false });
  const g = vaultToGeometry(vault);

  it('occlusion deepens with the concavity: open rim, darker funnel interior', async () => {
    const stats = await bakeVertexAO(g, { rays: 36, maxDistance: 5, seed: 7 });
    // real occlusion happened, and nothing left the physical range
    expect(stats.min).toBeGreaterThan(0.05);
    expect(stats.min).toBeLessThan(0.4);
    expect(stats.mean).toBeGreaterThan(0.3);
    expect(stats.mean).toBeLessThan(0.65);

    const pos = g.getAttribute('position');
    const ao = g.getAttribute('ao');
    let apexAo = -1; // (0,0,2): the deepest interior point of the closed funnel
    const rimAos: number[] = []; // (±1,±1,0): the open springing corners
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      if (Math.abs(z - 2) < 1e-9) apexAo = ao.getX(i);
      if (Math.abs(Math.abs(x) - 1) < 1e-9 && Math.abs(Math.abs(y) - 1) < 1e-9 && Math.abs(z) < 1e-9) {
        rimAos.push(ao.getX(i));
      }
    }
    expect(rimAos.length).toBe(4);
    const rimMean = rimAos.reduce((s, v) => s + v, 0) / rimAos.length;
    expect(rimMean).toBeGreaterThan(apexAo + 0.15);
    for (let i = 0; i < ao.count; i++) {
      expect(ao.getX(i)).toBeGreaterThanOrEqual(0);
      expect(ao.getX(i)).toBeLessThanOrEqual(1);
    }
  });

  it('leaves the geometry’s triangle order untouched (the rig depends on it)', async () => {
    const g2 = vaultToGeometry(vault);
    const before = Array.from((g2.getIndex()!.array as Uint32Array | Uint16Array).slice(0, 300));
    await bakeVertexAO(g2, { rays: 8, maxDistance: 4, seed: 3 });
    const after = Array.from((g2.getIndex()!.array as Uint32Array | Uint16Array).slice(0, 300));
    expect(after).toEqual(before);
  });

  it('is deterministic for a fixed seed', async () => {
    const g2 = vaultToGeometry(vault);
    const a = await bakeVertexAO(g2, { rays: 16, maxDistance: 5, seed: 42 });
    const g3 = vaultToGeometry(vault);
    const b = await bakeVertexAO(g3, { rays: 16, maxDistance: 5, seed: 42 });
    expect(a.mean).toBe(b.mean);
    expect(a.min).toBe(b.min);
  });
});

describe('the paint map (the painted vault)', () => {
  const plan: Plan = {
    sector: [pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)],
    placed: [place('square', 'cell', Iso.IDENTITY, 1)],
  };
  const vault = liftCurvedCells(plan, [{ placedIndex: 0, centralNode: 0 }]);
  const display = toDisplayGeometry(vaultToGeometry(vault));
  withPaintAttribute(display, vault.tris);
  const paint = display.getAttribute('paint');
  const orn = display.getAttribute('orn');
  const glow = display.getAttribute('glow');

  it('glazes exactly the roofs, one hue per cell', () => {
    for (let t = 0; t < vault.tris.length; t++) {
      const expected = vault.tris[t]!.role === 'roof' ? ((vault.tris[t]!.cell ?? 0) % 3 === 1 ? 2 : 1) : 0;
      for (let c = 0; c < 3; c++) expect(paint.getX(t * 3 + c)).toBe(expected);
    }
  });

  it('stencils exactly the facets, each field centred in its own frame', () => {
    let uMin = Infinity;
    let uMax = -Infinity;
    for (let t = 0; t < vault.tris.length; t++) {
      const isFacet = vault.tris[t]!.role === 'facet';
      for (let c = 0; c < 3; c++) {
        expect(orn.getZ(t * 3 + c)).toBe(isFacet ? 1 : 0);
        if (isFacet) {
          const u = orn.getX(t * 3 + c);
          // fitted coordinates: the field's own width maps to exactly ±1
          expect(Math.abs(u)).toBeLessThanOrEqual(1 + 1e-6);
          expect(Number.isFinite(orn.getY(t * 3 + c))).toBe(true);
          uMin = Math.min(uMin, u);
          uMax = Math.max(uMax, u);
        }
      }
    }
    expect(uMin).toBeCloseTo(-1, 6);
    expect(uMax).toBeCloseTo(1, 6);
  });

  it('gilds each bowl brightest at its apex, fading with distance', () => {
    let top = 0;
    for (let i = 0; i < glow.count; i++) {
      const v = glow.getX(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      top = Math.max(top, v);
    }
    expect(top).toBeCloseTo(1, 6); // the apex corner itself
  });
});
