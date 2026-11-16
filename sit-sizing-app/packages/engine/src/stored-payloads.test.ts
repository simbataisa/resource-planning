import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { upgradeStored } from '@sit/schemas';
import { computeBoth } from './compute.ts';
import { uncalibratedCount } from './calibration.ts';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from './defaults.ts';

/**
 * E-08 acceptance: old payload fixtures upgrade and recompute. Each file in golden/stored is a
 * payload as an earlier release stored it (jsonb key order included). Never edit them: add a
 * new fixture when the schema version changes.
 */
const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`../golden/stored/${name}`, import.meta.url), 'utf8')) as {
    schemaVersion: number;
    inputs: unknown;
    assumptions: unknown;
  };
type Expected = { fte: number; cases: number; hours: number };
const v1Result = JSON.parse(
  readFileSync(new URL('../golden/stored/v1-example-result.json', import.meta.url), 'utf8'),
) as { expected: { rough: Expected; detailed: Expected } };

describe('stored payloads (E-08)', () => {
  it('a release 1 payload upgrades and recomputes to its engine 1.0.0 result (ADR-0019)', () => {
    const f = read('v1-example.json');
    const { inputs, assumptions, upgradedFrom } = upgradeStored(f.schemaVersion, f);
    expect(upgradedFrom).toBe(1);
    const r = computeBoth(inputs, assumptions);
    for (const mode of ['rough', 'detailed'] as const) {
      // The result file keeps four decimals for FTE and two for hours.
      expect(r[mode].fte).toBeCloseTo(v1Result.expected[mode].fte, 3);
      expect(r[mode].hours).toBeCloseTo(v1Result.expected[mode].hours, 1);
      expect(r[mode].cases).toBe(v1Result.expected[mode].cases);
    }
    // Only the three resized rows differ from today's defaults; jsonb key order does not count.
    expect(uncalibratedCount(assumptions, DEFAULT_ASSUMPTIONS)).toBe(139);
  });

  it('the worked example with default assumptions matches the golden file', () => {
    const fresh = computeBoth(
      structuredClone(EXAMPLE_INPUTS),
      structuredClone(DEFAULT_ASSUMPTIONS),
    );
    const golden = JSON.parse(
      readFileSync(new URL('../golden/example.json', import.meta.url), 'utf8'),
    ) as { expected: { rough: Expected; detailed: Expected } };
    expect(fresh.detailed.fte).toBeCloseTo(golden.expected.detailed.fte, 3);
    expect(fresh.detailed.cases).toBe(golden.expected.detailed.cases);
    expect(uncalibratedCount(DEFAULT_ASSUMPTIONS, DEFAULT_ASSUMPTIONS)).toBe(142);
  });
});
