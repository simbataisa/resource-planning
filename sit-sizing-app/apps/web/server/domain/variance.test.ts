import { describe, expect, it } from 'vitest';
import { computeBoth, DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from '@sit/engine';
import { ActualsData, type Assumptions, type EstimateInputs } from '@sit/schemas';
import { canRecordActuals, compareRow, variance } from './variance';

const A = structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
const result = computeBoth(structuredClone(EXAMPLE_INPUTS) as EstimateInputs, A);
const D = result.detailed;

describe('variance (P-02: matches the manual calculation)', () => {
  it('compares totals with the detailed estimate', () => {
    // The worked example: 4,047 detailed cases. A cycle that ran 3,900 and used 3,800 hours.
    const v = variance(result, A, ActualsData.parse({ executedCases: 3900, totalHours: 3800 }));
    expect(v.totals[0]).toEqual({
      key: 'cases',
      estimate: 4047,
      actual: 3900,
      delta: -147,
      pct: -147 / 4047,
    });
    expect(v.totals[1]!.estimate).toBe(D.hours);
    expect(v.totals[1]!.delta).toBeCloseTo(3800 - D.hours, 9);
    expect(v.totals[1]!.pct).toBeCloseTo((3800 - D.hours) / D.hours, 12);
    expect(v.groups).toEqual([]);
  });

  it('derives the four rates the way a person would by hand', () => {
    const v = variance(
      result,
      A,
      ActualsData.parse({
        executedCases: 4000,
        totalHours: 3700,
        executionHours: 1500, // 1500 h × 60 / 4000 cases = 22.5 min per case
        designedCases: 1200,
        designHours: 360, // 360 × 60 / 1200 = 18 min per designed case
        retestedCases: 1000, // 1000 / 4000 = 25 %
        productiveHoursPerDay: 5.5,
      }),
    );
    expect(Object.fromEntries(v.rates.map((r) => [r.key, r.actual]))).toEqual({
      minutesPerCase: 22.5,
      designMinutesPerCase: 18,
      retestRate: 0.25,
      productiveHoursPerDay: 5.5,
    });
    expect(v.rates.map((r) => [r.path, r.assumption])).toEqual([
      ['minutes', [10, 20, 40]],
      ['designFSD', 15],
      ['retest', 0.2],
      ['hoursPerDay', 6],
    ]);
  });

  it('leaves rates empty when they were not measured, and never divides by zero', () => {
    const v = variance(
      result,
      A,
      ActualsData.parse({ executedCases: 0, totalHours: 10, retestedCases: 3 }),
    );
    expect(v.rates.every((r) => r.actual === null)).toBe(true);
    expect(compareRow('x', 0, 5)).toEqual({
      key: 'x',
      estimate: 0,
      actual: 5,
      delta: 5,
      pct: null,
    });
    expect(compareRow('x', 4, undefined)).toEqual({
      key: 'x',
      estimate: 4,
      actual: null,
      delta: null,
      pct: null,
    });
  });

  it('compares the groups the team tracked', () => {
    const v = variance(
      result,
      A,
      ActualsData.parse({
        executedCases: 1,
        totalHours: 1,
        groups: [{ group: 'api', cases: 200, hours: 150 }],
      }),
    );
    expect(v.groups.map((g) => g.key)).toEqual(['api.cases', 'api.hours']);
    expect(v.groups[0]).toMatchObject({ estimate: D.groups.api.cases, actual: 200 });
    expect(v.groups[0]!.delta).toBe(200 - D.groups.api.cases);
  });

  it('validates the input', () => {
    expect(ActualsData.safeParse({ executedCases: 1, totalHours: 1, designHours: 3 }).success).toBe(
      false,
    );
    expect(
      ActualsData.safeParse({
        executedCases: 1,
        totalHours: 1,
        groups: [
          { group: 'api', cases: 1, hours: 1 },
          { group: 'api', cases: 2, hours: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(ActualsData.safeParse({ executedCases: -1, totalHours: 1 }).success).toBe(false);
  });

  it('is recorded only against approved versions', () => {
    expect(
      ['DRAFT', 'SAVED', 'SUBMITTED', 'APPROVED', 'SUPERSEDED'].filter(canRecordActuals),
    ).toEqual(['APPROVED', 'SUPERSEDED']);
  });
});
