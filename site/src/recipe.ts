import { Iso, type Pt } from '@muqarnas/plan';
import type { TierSolution } from '@muqarnas/lift';
import { hashParams } from '@muqarnas/render';

/**
 * The one recipe for both readings — shared verbatim by the live site,
 * the prebake build script, and the fixture test, so all three always
 * mean the same vault. Every knob that shapes the baked output is in
 * PREBAKE_PARAMS, and its hash is embedded in the assets: change a knob
 * and stale files reject themselves.
 */

export const PREBAKE_PARAMS = {
  lift: { arcSegments: 4, rampSegments: 2, openCentreRadius: 4.3 },
  ao: { rays: 40, maxDistance: 7, seed: 1427 },
  readings: { a: 17, b: 18 }, // graphReach targets
} as const;

export const RECIPE_HASH = hashParams(PREBAKE_PARAMS);

export const BAKED_FILES = { a: 'baked/reading-a.bin', b: 'baked/reading-b.bin' } as const;

export const PLATE_SYMMETRIES = [0, 2, 4, 6].flatMap((k) => [
  Iso.rotation(k),
  Iso.reflection(2).then(Iso.rotation(k)),
]);

export const openCentre = (a: Pt, b: Pt): boolean => {
  const [ax, ay] = a.toNumbers();
  const [bx, by] = b.toNumbers();
  const r = PREBAKE_PARAMS.lift.openCentreRadius;
  return !(Math.hypot(ax, ay) < r && Math.hypot(bx, by) < r);
};

export const LIFT_OPTS = {
  arcSegments: PREBAKE_PARAMS.lift.arcSegments,
  rampSegments: PREBAKE_PARAMS.lift.rampSegments,
  closeBoundary: openCentre,
};

export function pickReadings(solutions: readonly TierSolution[]): {
  a: TierSolution;
  b: TierSolution;
} {
  const a = solutions.find((s) => s.graphReach === PREBAKE_PARAMS.readings.a) ?? solutions[0]!;
  const b =
    solutions.find((s) => s.graphReach === PREBAKE_PARAMS.readings.b) ??
    solutions.find((s) => s !== a) ??
    a;
  return { a, b };
}
