import { describe, expect, it } from 'vitest';
import { COEFFICIENT_PER_MODULE, kashiProfile, sexagesimal } from '@muqarnas/plan';
import { makeScene2Objects, toSexagesimal } from './scene2.js';

/**
 * Scene 2's measuring beat must land on the true taʿdīl of the drawn
 * construction — never a fudged display value. Al-Kāshī's printed
 * 1;43,33,45,41 runs short of the exact geometry (his factor digits;
 * Dold-Samplonius 1992, 223), and the scene shows both honestly.
 */

describe('scene 2 — the measure', () => {
  it('formats the exact coefficient as 1;43,33,48,40', () => {
    expect(toSexagesimal(COEFFICIENT_PER_MODULE)).toBe('1;43,33,48,40');
  });

  it('round-trips sexagesimal within a final truncated place', () => {
    const back = sexagesimal(toSexagesimal(COEFFICIENT_PER_MODULE));
    expect(COEFFICIENT_PER_MODULE - back).toBeGreaterThanOrEqual(0);
    expect(COEFFICIENT_PER_MODULE - back).toBeLessThan(1 / 60 ** 4);
  });

  it('bills the full trace to exactly the coefficient', () => {
    const profile = kashiProfile();
    const s = profile.factor + profile.curveLength;
    const billed = Math.min(s, profile.factor) + Math.max(0, s - profile.factor) / 2;
    expect(billed).toBeCloseTo(COEFFICIENT_PER_MODULE, 12);
  });

  it('al-Kāshī’s printed taʿdīl runs short of the drawn curve', () => {
    const printed = sexagesimal('1;43,33,45,41');
    expect(printed).toBeLessThan(COEFFICIENT_PER_MODULE);
    expect(COEFFICIENT_PER_MODULE - printed).toBeLessThan(2e-5);
  });

  it('draws the tracer over the same endpoints as the profile ink', () => {
    const o = makeScene2Objects();
    const endpoints = (l: typeof o.tracer) => {
      const pos = l.geometry.getAttribute('position');
      const copies = Number(l.userData.inkStrokeCopies ?? 1);
      const centre = Math.floor(copies / 2);
      const first = 2 * centre;
      const last = pos.count - 2 * copies + 2 * centre + 1;
      return {
        first: [pos.getX(first), pos.getZ(first)],
        last: [pos.getX(last), pos.getZ(last)],
      };
    };
    const t = endpoints(o.tracer);
    const pk = endpoints(o.profileInk);
    // both begin at the base of the facet…
    expect(t.first).toEqual([0, 0]);
    expect(pk.first).toEqual([0, 0]);
    // …and end on the top corner over the apex, A = (1, 2)
    expect(t.last[0]).toBeCloseTo(1, 9);
    expect(t.last[1]).toBeCloseTo(2, 9);
    expect(pk.last[0]).toBeCloseTo(1, 9);
    expect(pk.last[1]).toBeCloseTo(2, 9);
  });
});
