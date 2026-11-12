import type { Assumptions, EstimateInputs, Evidence } from '@sit/schemas';
import type { FieldProfile } from './counts.ts';
import type { Counts, Mode } from './types.ts';

/** Values shared by the driver modules during one compute() call. */
export interface Ctx {
  mode: Mode;
  A: Assumptions;
  S: EstimateInputs;
  /** Evidence in effect: the override for scenarios, otherwise the estimate's own. */
  E: Partial<Evidence>;
  c: Counts;
  fp: FieldProfile;
}
