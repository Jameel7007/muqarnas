export { Frac } from './frac.js';
export { Q2 } from './q2.js';
export {
  Pt,
  pt,
  Iso,
  cross2,
  dot2,
  perp,
  signedArea2,
  area,
  ensureCcw,
  lineIntersect,
  onSegmentStrict,
  angleUnits,
  interiorAngleUnits,
} from './geom.js';
export {
  ALPHABET,
  EXACT_AREAS,
  element,
  square,
  halfSquare,
  rhombus,
  halfRhombus,
  jug,
  largeBiped,
  almond,
  smallBiped,
  type ElementDef,
  type ElementKind,
  type Role,
} from './elements.js';
export {
  place,
  worldOutline,
  worldEdgeIndex,
  validatePlan,
  unfold,
  dihedralIsos,
  type Plan,
  type PlacedElement,
  type ValidationIssue,
  type ValidationResult,
} from './plan.js';
export { planToSvg, elementToSvg, KIND_COLORS, type PlanSvgOptions } from './svg.js';
export {
  kashiProfile,
  FACTOR_PER_MODULE,
  type KashiProfile,
  type KashiProfileOptions,
  type KashiConstruction,
  type RoofArc,
} from './profile.js';
export { gridVaultWedge, gridVaultFull } from './demo.js';
