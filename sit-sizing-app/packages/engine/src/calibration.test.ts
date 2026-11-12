import { describe, expect, it } from 'vitest';
import type { Assumptions } from '@sit/schemas';
import { isDefaultRow, uncalibratedCount } from './calibration.ts';
import { ASSUMPTION_PATHS } from './catalogue.ts';
import { DEFAULT_ASSUMPTIONS } from './defaults.ts';

const D = DEFAULT_ASSUMPTIONS as Assumptions;

/** Postgres jsonb stores object keys shorter-first, then bytewise. */
const jsonbOrder = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(jsonbOrder)
    : v !== null && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, x]) => [k, jsonbOrder(x)]),
        )
      : v;

describe('calibration status', () => {
  it('counts every row as uncalibrated for the defaults', () => {
    expect(uncalibratedCount(structuredClone(D), D)).toBe(ASSUMPTION_PATHS.length);
  });

  it('ignores object key order (values read back from jsonb)', () => {
    expect(uncalibratedCount(jsonbOrder(D) as Assumptions, D)).toBe(ASSUMPTION_PATHS.length);
  });

  it('flags a changed row, and only that row', () => {
    const a = structuredClone(D);
    a.criticalShare = 0.35;
    expect(isDefaultRow(a, D, 'criticalShare')).toBe(false);
    expect(uncalibratedCount(a, D)).toBe(ASSUMPTION_PATHS.length - 1);
  });
});
