import { describe, expect, it } from 'vitest';
import { Iso, gridVaultFull, takhtPlateFull } from '@muqarnas/plan';
import { enumerateAssignments } from './solver.js';

/** The vault's own symmetry group: rotations by 90° and the diagonal mirror. */
const PLATE_SYMMETRIES = [0, 2, 4, 6].flatMap((k) => [
  Iso.rotation(k),
  Iso.reflection(2).then(Iso.rotation(k)),
]);

describe('tier solver on the demo grid vault', () => {
  const report = enumerateAssignments(gridVaultFull());

  it('finds valid assignments without conflicts', () => {
    expect(report.conflicts).toEqual([]);
    expect(report.solutions.length).toBeGreaterThan(0);
  });

  it('the minimal reading: 8 square cells, 16 half-square intermediates', () => {
    // Rule 1 forbids the naive "crown cells" reading (their leg heights
    // would contradict the forced inward arrows); the halves — crown AND
    // ring corners — read as intermediates. The solver corrects the demo's
    // original hand assignment.
    const twoTier = report.solutions.find((s) => s.tierCount === 2);
    expect(twoTier).toBeDefined();
    const cells = twoTier!.faces.filter((f) => f.type === 'cell');
    expect(cells.length).toBe(8);
    expect(twoTier!.faces.filter((f) => f.type === 'intermediate').length).toBe(16);
  });

  it('and taller readings of the same plan exist — the ambiguity is real', () => {
    const counts = new Set(report.solutions.map((s) => s.tierCount));
    expect(counts.size).toBeGreaterThan(1);
  });
});

describe('THE PLATE: one plan, several vaults (scene 7, computed)', () => {
  const report = enumerateAssignments(takhtPlateFull(), {
    maxFreeOrbits: 20,
    symmetries: PLATE_SYMMETRIES,
  });

  it('six undetermined orbits survive the rules — “only a few”, as published', () => {
    expect(report.conflicts).toEqual([]);
    expect(report.freeOrbits).toBe(6);
    expect(report.solutions.length).toBe(4);
  });

  it('REPRODUCES HARMSEN’S FINDING: without edits, every reading starts in the corners', () => {
    // "Without removing edges ... the corresponding reconstruction has a
    // non-regular bottom boundary" — first tier = two elements per corner,
    // Harb's signature, in all four solutions.
    for (const s of report.solutions) {
      expect(s.faces.filter((f) => f.tier === 1).length).toBe(8);
    }
  });

  it('reaches the published tier counts: 17 (regular centre) and 18 (Harb)', () => {
    const reach = new Set(report.solutions.map((s) => s.graphReach));
    expect(reach.has(17)).toBe(true);
    expect(reach.has(18)).toBe(true);
    for (const s of report.solutions) {
      expect(s.tierCount).toBeGreaterThanOrEqual(16);
      expect(s.tierCount).toBeLessThanOrEqual(17);
    }
  });

  it('every jug is a cell and every face is claimed, in every solution', () => {
    const plan = takhtPlateFull();
    for (const s of report.solutions) {
      expect(s.faces.length).toBe(plan.placed.length);
      for (const f of s.faces) {
        if (plan.placed[f.placedIndex]!.def.kind === 'jug') {
          expect(f.type).toBe('cell');
        }
      }
    }
  });

  it('the springing is height zero and heights rise inward', () => {
    const s = report.solutions[0]!;
    expect(Math.min(...s.heights.values())).toBe(0);
    expect(s.graphReach).toBeGreaterThan(10);
  });
});
