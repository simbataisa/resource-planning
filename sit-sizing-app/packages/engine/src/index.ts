/**
 * @sit/engine — SIT sizing calculation engine (design section 6).
 *
 * Pure TypeScript: no I/O, no dates, no randomness, no UI text. Runs in the
 * browser on every keystroke and on the server when a version is saved.
 * A faithful port of the HTML prototype; golden parity is the contract
 * (golden/*.json). Any change to calculated numbers needs an ADR (AGENTS.md rule 3).
 *
 * Relative imports use explicit `.ts` extensions so the engine also runs
 * directly under Node's type stripping (used by the parity cross-check).
 */
export { ENGINE_VERSION } from './version.ts';
export { blankInputs, DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from './defaults.ts';
export { compute, computeBoth } from './compute.ts';
export { sensitivity, SENSITIVITY_ITEMS, type SensitivityRow } from './sensitivity.ts';
export { shiftLeftScenarios, type Scenario, type ScenarioKey } from './scenarios.ts';
export { derivedRows, type DerivedRow, type ParamValue } from './derived.ts';
export { calendarChecks, type CalendarCheck } from './calendar.ts';
export { uncalibratedCount, isDefaultRow } from './calibration.ts';
export { gapRows, topGap, type GapRow } from './gap.ts';
export { itemHours } from './rubric.ts';
export { fromPrototypeProfile, mergeShape, PrototypeImportError } from './prototype-import.ts';
export { toStoredResult, toSummary } from './summary.ts';
export { versionSnapshot } from './snapshot.ts';
export { customSizePaths, isBuiltInSize, sameSizeSet, unknownFeatureSizes } from './sizes.ts';
export { credit, type Credit } from './credit.ts';
export {
  ASSUMPTION_PATHS,
  assumptionPaths,
  FIXED_ASSUMPTION_PATHS,
  SIZE_ROW_TABLES,
  DRIVERS,
  FIELD_TYPES,
  GROUP_KEYS,
  GROUPS,
  PT_TYPES,
  SIZES,
  type Driver,
  type Family,
  type GroupKey,
} from './catalogue.ts';
export type {
  BothResults,
  Counts,
  Explain,
  GroupTotal,
  Mode,
  ModeResult,
  PtHours,
} from './types.ts';
