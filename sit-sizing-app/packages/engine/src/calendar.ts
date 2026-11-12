import type { Assumptions, EstimateInputs } from '@sit/schemas';
import type { BothResults } from './types.ts';

export type CalendarCheck =
  | {
      kind: 'data';
      cycles: number;
      daysPerCycle: number;
      daysNeeded: number;
      windowDays: number;
      fits: boolean;
    }
  | {
      kind: 'ai';
      smeLabelHours: number;
      smes: number;
      days: number;
      halfWindowDays: number;
      windowDays: number;
      fits: boolean;
    }
  | {
      kind: 'performance';
      cycles: number;
      daysPerCycle: number;
      daysNeeded: number;
      windowDays: number;
      fits: boolean;
    };

/**
 * Calendar checks against the SIT window (prototype updateDai):
 * data load cycles, SME labelling time for the AI golden set, and
 * performance test-and-tune cycles. Detailed results are used when that
 * mode has the scope, otherwise rough.
 */
export function calendarChecks(
  result: BothResults,
  inputs: EstimateInputs,
  A: Assumptions,
): CalendarCheck[] {
  const D = result.detailed;
  const R = result.rough;
  const P = D.explain.dOn || D.explain.aOn ? D : R;
  const x = P.explain;
  const windowDays = (Number(inputs.team.weeks) || 0) * A.daysPerWeek;
  const out: CalendarCheck[] = [];
  if (x.dOn) {
    const need = A.dataCycles * A.dataDaysPerCycle;
    out.push({
      kind: 'data',
      cycles: A.dataCycles,
      daysPerCycle: A.dataDaysPerCycle,
      daysNeeded: need,
      windowDays,
      fits: !(need > windowDays),
    });
  }
  if (x.aOn) {
    const smes = Math.max(1, Number(inputs.team.aiSmes) || 1);
    const days = P.smeLabelHours / (smes * A.hoursPerDay);
    const half = windowDays / 2;
    out.push({
      kind: 'ai',
      smeLabelHours: P.smeLabelHours,
      smes,
      days,
      halfWindowDays: half,
      windowDays,
      fits: !(days > half),
    });
  }
  const Q = (D.explain.ptOn ? D : R).explain;
  if (Q.ptOn) {
    const pd = Q.ptCycles * A.ptEnvDays;
    out.push({
      kind: 'performance',
      cycles: Q.ptCycles,
      daysPerCycle: A.ptEnvDays,
      daysNeeded: pd,
      windowDays,
      fits: !(pd > windowDays),
    });
  }
  return out;
}
