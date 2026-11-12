import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { uncalibratedCount } from './calibration.ts';
import { computeBoth } from './compute.ts';
import { DEFAULT_ASSUMPTIONS } from './defaults.ts';
import { toStoredResult } from './summary.ts';

/**
 * Everything the server stores when it saves a draft or a version (design 4.1:
 * the server recomputes and never trusts a client-computed total).
 * FTE columns are rounded to 2 decimals to match the database column.
 */
export function versionSnapshot(inputs: EstimateInputs, assumptions: Assumptions) {
  const both = computeBoth(inputs, assumptions);
  return {
    result: toStoredResult(both),
    engineVersion: both.engineVersion,
    roughFte: Math.round(both.rough.fte * 100) / 100,
    detailedFte: Math.round(both.detailed.fte * 100) / 100,
    totalCasesDetailed: both.detailed.cases,
    uncalibrated: uncalibratedCount(assumptions, DEFAULT_ASSUMPTIONS),
  };
}
