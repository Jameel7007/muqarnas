import { gridVaultFull } from '@muqarnas/plan';
import { DEFAULT_SIMPLE_PARAMS, liftSimple, type LiftedVault, type SimpleLiftParams } from './simple.js';

/**
 * The demo grid vault, lifted. Every element of the wedge has its front rib
 * at canonical edge 1 (a happy accident of the demo's construction), so the
 * cell specs are uniform; tiers ride along from the plan's hints.
 */
export function gridVaultLifted(params: SimpleLiftParams = DEFAULT_SIMPLE_PARAMS): {
  vault: LiftedVault;
  plan: ReturnType<typeof gridVaultFull>;
} {
  const plan = gridVaultFull();
  const specs = plan.placed.map((_, i) => ({ placedIndex: i, frontEdge: 1 }));
  return { vault: liftSimple(plan, specs, params), plan };
}
