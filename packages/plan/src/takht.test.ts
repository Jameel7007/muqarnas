import { describe, expect, it } from 'vitest';
import { Q2 } from './q2.js';
import { Frac } from './frac.js';
import { Iso, area } from './geom.js';
import { validatePlan, worldOutline } from './plan.js';
import { PLATE_FIELD_SPAN, takhtPlate } from './takht.js';
import { PLATE_PLACEMENTS } from './takht-plate-data.js';

describe('THE TAKHT-I SULAYMĀN QUARTER PLAN (the ship gate)', () => {
  const plan = takhtPlate();

  it('exact cover: 157 elements tile the quarter with zero gap and zero overlap', () => {
    expect(plan.placed.length).toBe(157);
    const r = validatePlan(plan);
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('census matches the digitization: 61 squares, 90 rhombi, 2 jugs, 4 half-rhombi', () => {
    const census: Record<string, number> = {};
    for (const p of plan.placed) census[p.def.kind] = (census[p.def.kind] ?? 0) + 1;
    expect(census).toEqual({ square: 61, rhombus: 90, jug: 2, 'half-rhombus': 4 });
  });

  it('total area is exactly 61 + 47√2 square modules', () => {
    const r = validatePlan(plan);
    expect(r.sectorArea.eq(new Q2(Frac.of(61), Frac.of(47)))).toBe(true);
    expect(r.tiledArea.eq(r.sectorArea)).toBe(true);
  });

  it('is symmetric about the diagonal through the vault centre', () => {
    const key = (verts: { key(): string }[]) =>
      verts
        .map((v) => v.key())
        .sort()
        .join('#');
    const original = new Set(plan.placed.map((p) => key(worldOutline(p).verts)));
    for (const p of plan.placed) {
      const mirrored = { ...p, iso: p.iso.then(Iso.reflection(2)) };
      expect(original.has(key(worldOutline(mirrored).verts))).toBe(true);
    }
  });

  it('the regularized field spans 7 + 3.5√2 ≈ 11.9497 modules, not the plate’s 12', () => {
    let maxX = Q2.ZERO;
    for (const v of plan.sector) if (v.x.gt(maxX)) maxX = v.x;
    expect(maxX.eq(PLATE_FIELD_SPAN)).toBe(true);
    expect(PLATE_FIELD_SPAN.toNumber()).toBeCloseTo(11.9497, 4);
  });

  it('the two diagonal jugs sit on the symmetry axis, apex toward the star', () => {
    const jugs = PLATE_PLACEMENTS.filter((p) => p.kind === 'jug');
    expect(jugs.length).toBe(2);
    for (const j of jugs) {
      expect(j.tx).toEqual(j.ty); // on the diagonal
      expect(j.rot).toBe(0); // corner toward the vault centre
      expect(j.refl).toBe(false);
    }
  });

  it('the vault centre corner is open — the crown bite of the irregular quarter octagon', () => {
    // no sector vertex at the origin: the tiling stops short of the centre corner
    expect(plan.sector.some((v) => v.x.isZero() && v.y.isZero())).toBe(false);
  });
});
