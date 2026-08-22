import { describe, expect, it } from 'vitest';
import { Q2 } from './q2.js';
import { Iso, pt, area, interiorAngleUnits } from './geom.js';
import {
  ALPHABET,
  EXACT_AREAS,
  almond,
  element,
  halfRhombus,
  halfSquare,
  jug,
  largeBiped,
  rhombus,
  smallBiped,
  square,
  type ElementKind,
} from './elements.js';
import { place, validatePlan, worldOutline, type Plan } from './plan.js';

describe('alphabet derivation', () => {
  it('constructs eight of the nine shapes (barley kernel pending sources)', () => {
    expect(ALPHABET.size).toBe(8);
  });

  it('areas are exact', () => {
    for (const [kind, def] of ALPHABET) {
      const expected = EXACT_AREAS[kind]!;
      expect(area([...def.verts]).eq(expected), `${kind} area`).toBe(true);
    }
  });

  it('both bipeds have the same area, 1 − √2/2', () => {
    expect(EXACT_AREAS['large-biped']!.eq(EXACT_AREAS['small-biped']!)).toBe(true);
  });

  it('interior angle signatures (units of 22.5°)', () => {
    const expected: Record<Exclude<ElementKind, 'barley-kernel'>, number[]> = {
      square: [4, 4, 4, 4],
      'half-square': [2, 4, 2],
      rhombus: [2, 6, 2, 6],
      'half-rhombus': [2, 3, 3],
      jug: [4, 3, 6, 3],
      'large-biped': [1, 4, 1, 10],
      almond: [2, 4, 6, 4],
      'small-biped': [2, 2, 2, 10],
    };
    for (const [kind, def] of ALPHABET) {
      const angles = def.verts.map((_, i) => interiorAngleUnits(def.verts, i));
      expect(angles, kind).toEqual(expected[kind as keyof typeof expected]);
    }
  });

  it('almond’s fourth vertex lies on the long diagonal of the rhombus', () => {
    const c = almond().verts[2]!;
    // long diagonal direction is 22.5°: tan = √2 − 1 exactly
    expect(c.y.div(c.x).eq(Q2.SQRT2_M1)).toBe(true);
  });

  it('jug’s apex is at unit distance from the corner (the unit short diagonal)', () => {
    const v2 = jug().verts[2]!;
    const d2 = v2.x.mul(v2.x).add(v2.y.mul(v2.y));
    expect(d2.eq(Q2.ONE)).toBe(true);
  });
});

describe('complements tile their seeds exactly', () => {
  const check = (plan: Plan) => {
    const r = validatePlan(plan);
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
  };

  it('jug ∪ large biped = square', () => {
    check({
      sector: [...square().verts],
      placed: [place('jug', 'cell'), place('large-biped', 'intermediate')],
    });
  });

  it('almond ∪ small biped = rhombus', () => {
    check({
      sector: [...rhombus().verts],
      placed: [place('almond', 'cell'), place('small-biped', 'intermediate')],
    });
  });

  it('two half-squares = square', () => {
    check({
      sector: [...square().verts],
      placed: [
        place('half-square', 'cell'),
        place('half-square', 'cell', Iso.reflection(2)), // across the diagonal
      ],
    });
  });

  it('two half-rhombi = rhombus', () => {
    const r = rhombus().verts;
    const c2 = r[2]!; // point rotation by 180° about the rhombus centre: p ↦ 2c − p
    check({
      sector: [...r],
      placed: [
        place('half-rhombus', 'cell'),
        place('half-rhombus', 'cell', Iso.rotation(4).then(Iso.translation(c2))),
      ],
    });
  });
});

describe('role enforcement (al-Kāshī’s cell/intermediate distinction)', () => {
  it('a jug can never be an intermediate', () => {
    expect(() => place('jug', 'intermediate')).toThrow(/role violation/);
  });
  it('a large biped can never be a cell', () => {
    expect(() => place('large-biped', 'cell')).toThrow(/role violation/);
  });
  it('a small biped can never be a cell', () => {
    expect(() => place('small-biped', 'cell')).toThrow(/role violation/);
  });
  it('squares and rhombi may serve either role', () => {
    expect(() => place('square', 'intermediate')).not.toThrow();
    expect(() => place('rhombus', 'intermediate')).not.toThrow();
  });
});

describe('worldOutline under reflection', () => {
  it('stays CCW and remaps curved edges to the same geometric edges', () => {
    const placed = place('jug', 'cell', Iso.reflection(0)); // across the x-axis
    const { verts, curvedEdges } = worldOutline(placed);
    // still CCW
    expect(area(verts).eq(EXACT_AREAS['jug']!)).toBe(true);
    // curved edges must connect (1,0)–(√2/2,−√2/2) and (√2/2,−√2/2)–(0,−1)
    const apex = Iso.reflection(0).apply(jug().verts[2]!);
    const keys = curvedEdges.map((i) => {
      const a = verts[i]!;
      const b = verts[(i + 1) % verts.length]!;
      return [a.key(), b.key()].sort().join('~');
    });
    const expected = [
      [pt(1, 0).key(), apex.key()].sort().join('~'),
      [apex.key(), pt(0, -1).key()].sort().join('~'),
    ];
    expect(new Set(keys)).toEqual(new Set(expected));
  });
});

describe('halves really are halves', () => {
  it('half-square is half the square, half-rhombus half the rhombus', () => {
    expect(area([...halfSquare().verts]).mul(Q2.TWO).eq(area([...square().verts]))).toBe(true);
    expect(area([...halfRhombus().verts]).mul(Q2.TWO).eq(area([...rhombus().verts]))).toBe(true);
  });
  it('subtraction identities hold exactly', () => {
    expect(area([...jug().verts]).add(area([...largeBiped().verts])).eq(Q2.ONE)).toBe(true);
    expect(
      area([...almond().verts]).add(area([...smallBiped().verts])).eq(area([...rhombus().verts])),
    ).toBe(true);
  });
  it('element() throws for the unconstructed kind', () => {
    expect(() => element('barley-kernel')).toThrow(/not constructed/);
  });
});
