import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addSizeList, Assumptions, EstimateInputs } from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import { compute, GROUP_KEYS } from '../src/index.ts';

/**
 * Golden parity (design 6.4): every golden file was produced by the HTML prototype.
 * Cases per group are exact; hours to 0.01; FTE and range to 0.0001.
 * Never edit files in golden/ without an ADR (AGENTS.md rule 3).
 */
interface Expected {
  cases: number;
  hours: number;
  fte: number;
  lo: number;
  hi: number;
  smeLabelHours: number;
  groups: Record<string, { cases: number; hours: number }>;
}
interface GoldenFile {
  name: string;
  description: string;
  assumptions: unknown;
  scope: unknown;
  expected: { rough: Expected; detailed: Expected };
}

/** Golden values are rounded (hours 2 dp, FTE 4 dp), so allow exactly half a unit in the last place. */
function near(actual: number, expected: number | undefined, dp: number, label: string) {
  expect(Math.abs(actual - (expected ?? Number.NaN)), label).toBeLessThanOrEqual(
    0.5 * 10 ** -dp + 1e-9,
  );
}

const dir = fileURLToPath(new URL('../golden/', import.meta.url));
const files: GoldenFile[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as GoldenFile)
  // Golden files keep the prototype's shape, which has no size list: add it as a stored
  // payload is upgraded (ADR-0021), so the files themselves never change.
  .map((g) => ({
    ...g,
    assumptions: addSizeList({ inputs: g.scope, assumptions: structuredClone(g.assumptions) })
      .assumptions as GoldenFile['assumptions'],
  }));

describe('golden files', () => {
  it('has the reference example plus at least 25 further cases', () => {
    expect(files.some((f) => f.name === 'example')).toBe(true);
    expect(files.length).toBeGreaterThanOrEqual(26);
  });
});

describe.each(files)('golden: $name', (g) => {
  it('assumptions and scope parse with the schemas without loss (E-01)', () => {
    expect(Assumptions.parse(g.assumptions)).toEqual(g.assumptions);
    expect(EstimateInputs.parse(g.scope)).toEqual(g.scope);
  });

  for (const mode of ['rough', 'detailed'] as const) {
    it(`${mode}: matches the prototype`, () => {
      const A = Assumptions.parse(g.assumptions);
      const S = EstimateInputs.parse(g.scope);
      const r = compute(mode, S, A);
      const e = g.expected[mode];
      for (const k of GROUP_KEYS) {
        expect(r.groups[k].cases, `${k} cases`).toBe(e.groups[k]?.cases);
        near(r.groups[k].hours, e.groups[k]?.hours, 2, `${k} hours`);
      }
      expect(r.cases).toBe(e.cases);
      near(r.hours, e.hours, 2, 'hours');
      near(r.fte, e.fte, 4, 'fte');
      near(r.lo, e.lo, 4, 'lo');
      near(r.hi, e.hi, 4, 'hi');
      near(r.smeLabelHours, e.smeLabelHours, 2, 'smeLabelHours');
    });
  }
});
