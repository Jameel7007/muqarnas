/**
 * @muqarnas/lift — plan + tier assignment → watertight 3D mesh.
 * Pure geometry; no three.js imports here, ever.
 *
 * v0: the simple (plane-faceted) type, cells only, front ribs supplied.
 * Next: intermediates, the tier-assignment solver (enumerateAssignments),
 * and the curved (qawsī) type on the §4 profile.
 */
export { MeshBuilder, manifoldReport, projectedTriangleArea, surfaceArea, type Mesh, type ManifoldReport } from './mesh.js';
export {
  liftSimple,
  cellPlanArea,
  DEFAULT_SIMPLE_PARAMS,
  type SimpleLiftParams,
  type CellSpec,
  type LiftedTriangle,
  type LiftedVault,
} from './simple.js';
export { gridVaultLifted } from './demo.js';
export {
  liftCurvedCells,
  profileHeight,
  profileSegments,
  CELL_HEIGHT,
  DEFAULT_CURVED_PARAMS,
  type CurvedCellSpec,
  type CurvedLiftParams,
  type CurvedVault,
} from './curved.js';
export {
  enumerateAssignments,
  type SolvedFace,
  type TierSolution,
  type SolverReport,
  type SolverOptions,
} from './solver.js';
export { liftVault, type VaultFaceSpec, type VaultLiftOptions } from './curved.js';
