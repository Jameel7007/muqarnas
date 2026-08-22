import { describe, expect, it } from 'vitest';
import { Iso, pt } from './geom.js';
import { place, validatePlan, type Plan } from './plan.js';
import { gridVaultFull, gridVaultWedge } from './demo.js';

describe('tiling closure (the hard invariant)', () => {
  it('the demo wedge tiles its sector exactly', () => {
    const r = validatePlan(gridVaultWedge());
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('the unfolded full plan tiles exactly — seams cancel', () => {
    const full = gridVaultFull();
    expect(full.placed.length).toBe(24);
    const r = validatePlan(full);
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('a missing element is reported as a gap', () => {
    const wedge = gridVaultWedge();
    const broken: Plan = { sector: wedge.sector, placed: wedge.placed.slice(1) };
    const r = validatePlan(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.kind === 'area')).toBe(true);
    expect(r.issues.some((i) => i.kind === 'edge')).toBe(true);
  });

  it('a duplicated element is reported as an overlap', () => {
    const wedge = gridVaultWedge();
    const broken: Plan = { sector: wedge.sector, placed: [...wedge.placed, wedge.placed[1]!] };
    const r = validatePlan(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.kind === 'area')).toBe(true);
  });

  it('a shifted element breaks closure', () => {
    const wedge = gridVaultWedge();
    const shifted = place('square', 'cell', Iso.translation(pt(1, 1)), 1);
    const broken: Plan = {
      sector: wedge.sector,
      placed: [wedge.placed[0]!, shifted, wedge.placed[2]!],
    };
    const r = validatePlan(broken);
    expect(r.ok).toBe(false);
  });

  it('a wrongly-wound sector is rejected', () => {
    const wedge = gridVaultWedge();
    const r = validatePlan({ sector: [...wedge.sector].reverse(), placed: [...wedge.placed] });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.kind === 'winding')).toBe(true);
  });
});
