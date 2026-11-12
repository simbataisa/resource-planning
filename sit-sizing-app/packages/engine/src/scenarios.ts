import type { Assumptions, EstimateInputs, Evidence } from '@sit/schemas';
import { compute } from './compute.ts';
import type { ModeResult } from './types.ts';

export type ScenarioKey = 'allGates' | 'current' | 'noGates';

export interface Scenario {
  key: ScenarioKey;
  evidence: Partial<Evidence>;
  result: ModeResult;
}

/**
 * Shift-left scenarios on the detailed estimate (prototype renderScen):
 * every gate met, the current evidence, and nothing proven before SIT.
 */
export function shiftLeftScenarios(inputs: EstimateInputs, assumptions: Assumptions): Scenario[] {
  const A = assumptions;
  const ev = inputs.evidence;
  const allGates: Partial<Evidence> = {
    mutation: Math.max(A.mutationGate, 80),
    valBE: 100,
    valFE: 100,
    mapCov: 100,
    jacoco: 90,
    feUnit: Math.max(A.feUnitGate, 90),
    feMut: Math.max(A.feMutGate, 80),
    ruleCov: 100,
    iosUnit: Math.max(A.mobileUnitGate, 90),
    androidUnit: Math.max(A.mobileUnitGate, 90),
    dqCov: 100,
    contractCov: 100,
    goldenReuse: ev.goldenReuse,
    evalCI: true,
    ptCI: true,
  };
  const noGates: Partial<Evidence> = {
    mutation: 0,
    valBE: 0,
    valFE: 0,
    mapCov: 0,
    jacoco: 0,
    feUnit: 0,
    feMut: 0,
    ruleCov: 0,
    iosUnit: 0,
    androidUnit: 0,
    dqCov: 0,
    contractCov: 0,
    goldenReuse: ev.goldenReuse,
    evalCI: false,
    ptCI: false,
  };
  return (
    [
      ['allGates', allGates],
      ['current', ev],
      ['noGates', noGates],
    ] as const
  ).map(([key, evidence]) => ({ key, evidence, result: compute('detailed', inputs, A, evidence) }));
}
