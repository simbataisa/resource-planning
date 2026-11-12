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
const golden = JSON.parse(
  readFileSync(new URL('../golden/example.json', import.meta.url), 'utf8'),
) as {
  expected: { rough: { fte: number; cases: number }; detailed: { fte: number; cases: number } };
};

describe('stored payloads (E-08)', () => {
  it('a release 1 payload upgrades and recomputes to the worked example', () => {
    const f = read('v1-example.json');
    const { inputs, assumptions, upgradedFrom } = upgradeStored(f.schemaVersion, f);
    expect(upgradedFrom).toBeNull();
    const r = computeBoth(inputs, assumptions);
    // The golden file keeps four decimals; the in-memory example must match exactly.
    expect(r.rough.fte).toBeCloseTo(golden.expected.rough.fte, 3);
    expect(r.detailed.fte).toBeCloseTo(golden.expected.detailed.fte, 3);
    const fresh = computeBoth(
      structuredClone(EXAMPLE_INPUTS),
      structuredClone(DEFAULT_ASSUMPTIONS),
    );
    expect(r.rough.fte).toBe(fresh.rough.fte);
    expect(r.detailed.fte).toBe(fresh.detailed.fte);
    expect(r.detailed.hours).toBe(fresh.detailed.hours);
    expect(r.detailed.cases).toBe(golden.expected.detailed.cases);
    // jsonb key order does not make defaults look calibrated.
    expect(uncalibratedCount(assumptions, DEFAULT_ASSUMPTIONS)).toBe(142);
  });
});
