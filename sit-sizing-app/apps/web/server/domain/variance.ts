/**
 * Actuals against the estimate (design 7, release 3 P-02). Pure: the service passes the
 * version's stored result and assumptions in.
 *
 * - Totals and groups compare with the detailed mode: actuals are recorded after SIT, when
 *   the FSD exists. Variance = actual − estimate; pct = variance / estimate (null if 0).
 * - Rates put each measured rate next to the assumption it informs, with that assumption's
 *   path. Nothing is changed automatically (design 3 non-goal): a person decides whether
 *   to update a profile.
 */
import type { ActualsData, Assumptions, EstimateResult, Variance } from '@sit/schemas';

type Row = Variance['totals'][number];

export function compareRow(key: string, estimate: number, actual: number | undefined): Row {
  if (actual === undefined) return { key, estimate, actual: null, delta: null, pct: null };
  const delta = actual - estimate;
  return { key, estimate, actual, delta, pct: estimate === 0 ? null : delta / estimate };
}

const ratio = (num: number | undefined, den: number | undefined, scale = 1) =>
  num === undefined || den === undefined || den === 0 ? null : (num * scale) / den;

export function variance(
  result: Pick<EstimateResult, 'detailed'>,
  assumptions: Pick<Assumptions, 'minutes' | 'designFSD' | 'retest' | 'hoursPerDay'>,
  d: ActualsData,
): Variance {
  const D = result.detailed;
  return {
    totals: [
      compareRow('cases', D.cases, d.executedCases),
      compareRow('hours', D.hours, d.totalHours),
    ],
    groups: d.groups.flatMap((g) => [
      compareRow(`${g.group}.cases`, D.groups[g.group].cases, g.cases),
      compareRow(`${g.group}.hours`, D.groups[g.group].hours, g.hours),
    ]),
    rates: [
      {
        key: 'minutesPerCase',
        path: 'minutes',
        assumption: [...assumptions.minutes],
        actual: ratio(d.executionHours, d.executedCases, 60),
      },
      {
        key: 'designMinutesPerCase',
        path: 'designFSD',
        assumption: assumptions.designFSD,
        actual: ratio(d.designHours, d.designedCases, 60),
      },
      {
        key: 'retestRate',
        path: 'retest',
        assumption: assumptions.retest,
        actual: ratio(d.retestedCases, d.executedCases),
      },
      {
        key: 'productiveHoursPerDay',
        path: 'hoursPerDay',
        assumption: assumptions.hoursPerDay,
        actual: d.productiveHoursPerDay ?? null,
      },
    ],
  };
}

/** Actuals are recorded against a version that was approved (it may since be superseded). */
export const canRecordActuals = (status: string) =>
  status === 'APPROVED' || status === 'SUPERSEDED';
