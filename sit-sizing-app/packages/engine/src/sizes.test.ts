import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import { uncalibratedCount } from './calibration.ts';
import { ASSUMPTION_PATHS, assumptionPaths, FIXED_ASSUMPTION_PATHS, SIZES } from './catalogue.ts';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from './defaults.ts';
import { SENSITIVITY_ITEMS } from './sensitivity.ts';
import { customSizePaths, isBuiltInSize, sameSizeSet, unknownFeatureSizes } from './sizes.ts';
import { versionSnapshot } from './snapshot.ts';

const D = DEFAULT_ASSUMPTIONS as Assumptions;
const TABLES = ['proxies', 'dproxies', 'aproxies', 'ptRoughScen'] as const;

/** Defaults with `name` added as a copy of `from`. */
function withSize(name: string, from = 'S', a: Assumptions = structuredClone(D)): Assumptions {
  for (const t of TABLES) {
    const table = a[t] as Record<string, unknown>;
    table[name] = structuredClone(table[from]);
  }
  a.sizes = [...a.sizes, name];
  return a;
}
function withoutSize(name: string, a: Assumptions = structuredClone(D)): Assumptions {
  for (const t of TABLES) delete (a[t] as Record<string, unknown>)[name];
  a.sizes = a.sizes.filter((s) => s !== name);
  return a;
}

describe('assumption paths follow the sizes (ADR-0021)', () => {
  it('has 130 fixed rows, 160 with the ten built-in sizes', () => {
    expect(FIXED_ASSUMPTION_PATHS).toHaveLength(130);
    expect(FIXED_ASSUMPTION_PATHS).toContain('ptRoughScen');
    expect(assumptionPaths(D)).toHaveLength(160);
    expect(assumptionPaths(D)).toEqual(ASSUMPTION_PATHS);
  });

  it('adds three rows per size, in the order of sizes', () => {
    const paths = assumptionPaths({ sizes: ['S', 'Z', 'M'] });
    expect(paths).toHaveLength(139);
    expect(paths.filter((p) => p.startsWith('proxies.'))).toEqual([
      'proxies.S',
      'proxies.Z',
      'proxies.M',
    ]);
  });

  it('knows the built-in names and lists custom-size paths', () => {
    expect(SIZES.every(isBuiltInSize)).toBe(true);
    expect(isBuiltInSize('XS2')).toBe(false);
    expect(customSizePaths({ sizes: ['S', 'XS2'] })).toEqual([
      'dproxies.XS2',
      'aproxies.XS2',
      'proxies.XS2',
    ]);
  });
});

describe('calibration with custom sizes (ADR-0021)', () => {
  it('counts every default row as uncalibrated', () => {
    expect(uncalibratedCount(structuredClone(D), D)).toBe(160);
  });

  it('counts a custom size as uncalibrated until it has notes', () => {
    const a = withSize('XS2');
    expect(uncalibratedCount(a, D)).toBe(163);
    const note = { source: 'Synthetic pilot' };
    a.sizeNotes = { 'proxies.XS2': note, 'dproxies.XS2': note, 'aproxies.XS2': note };
    expect(uncalibratedCount(a, D)).toBe(160);
  });

  it('takes notes from the argument when given (profiles keep theirs apart)', () => {
    const a = withSize('XS2');
    expect(uncalibratedCount(a, D, { 'proxies.XS2': { source: 'x' } })).toBe(162);
  });

  it('judges the performance scenarios row by its built-in sizes only', () => {
    const a = withSize('XS2');
    (a.ptRoughScen as Record<string, number>).XS2 = 99;
    expect(uncalibratedCount(a, D)).toBe(163);
    (a.ptRoughScen as Record<string, number>).M = 7;
    expect(uncalibratedCount(a, D)).toBe(162);
  });

  it('counts neither way the rows of a removed built-in size', () => {
    expect(uncalibratedCount(withoutSize('XXS'), D)).toBe(157);
  });
});

describe('size checks for estimates (ADR-0021)', () => {
  const inputs = (sizes: string[]) =>
    ({
      ...structuredClone(EXAMPLE_INPUTS),
      features: sizes.map((size, i) => ({ name: `F${i}`, size, cx: 1, qty: 1 })),
    }) as unknown as EstimateInputs;

  it('groups features by a size the assumptions do not have', () => {
    expect(unknownFeatureSizes(inputs(['XXL', 'M', 'XXL', 'Q']), withoutSize('XXL'))).toEqual([
      { size: 'XXL', features: 2 },
      { size: 'Q', features: 1 },
    ]);
    expect(unknownFeatureSizes(inputs(['M']), D)).toEqual([]);
  });

  it('compares the size list and every table key set', () => {
    expect(sameSizeSet(D, structuredClone(D))).toBe(true);
    const reordered = structuredClone(D);
    reordered.sizes = [...reordered.sizes].reverse();
    expect(sameSizeSet(D, reordered)).toBe(false);
    const extraKey = structuredClone(D);
    (extraKey.proxies as Record<string, unknown>).Z = structuredClone(D.proxies.S);
    expect(sameSizeSet(D, extraKey)).toBe(false);
  });
});

describe('sensitivity with custom sizes (ADR-0021)', () => {
  it('scales the drivers of every size in the list', () => {
    const a = withSize('Z');
    const before = a.proxies.Z!.screen;
    SENSITIVITY_ITEMS.find((i) => i.key === 'proxies')!.apply(a, 1.1);
    expect(a.proxies.Z!.screen).toBeCloseTo(before * 1.1);
  });
});

describe('versionSnapshot row total (ADR-0021)', () => {
  it('stores the number of assumption rows', () => {
    const s = versionSnapshot(
      structuredClone(EXAMPLE_INPUTS) as EstimateInputs,
      structuredClone(D),
    );
    expect(s.assumptionRows).toBe(160);
    expect(
      versionSnapshot(structuredClone(EXAMPLE_INPUTS) as EstimateInputs, withSize('Z'))
        .assumptionRows,
    ).toBe(163);
  });
});
