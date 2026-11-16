import { describe, expect, it } from 'vitest';
import {
  INPUTS_SCHEMA_VERSION,
  addFeatureSizes,
  addSizeList,
  expandLegacyDataShapes,
  NEW_FEATURE_SIZE_DEFAULTS,
  StoredPayloadError,
  UPGRADES,
  upgradeStored,
  type UpgradeStep,
} from './upgrade';

/** A minimal valid payload is not needed here: these tests check the chain, then validation. */
const bad = { inputs: { nope: true }, assumptions: {} };

describe('upgradeStored (E-08)', () => {
  it('is at schema version 4, with steps from versions 1, 2 and 3 (ADR-0019, ADR-0020, ADR-0021)', () => {
    expect(INPUTS_SCHEMA_VERSION).toBe(4);
    expect(Object.keys(UPGRADES)).toEqual(['1', '2', '3']);
    expect(UPGRADES[1]).toBe(expandLegacyDataShapes);
    expect(UPGRADES[2]).toBe(addFeatureSizes);
  });

  it('runs every step from the stored version to the current one, in order', () => {
    const seen: number[] = [];
    const step =
      (n: number): UpgradeStep =>
      (p) => {
        seen.push(n);
        return { ...p, inputs: { ...(p.inputs as object), [`v${n + 1}`]: true } };
      };
    const steps = { 1: step(1), 2: step(2), 3: step(3) };
    expect(() => upgradeStored(2, bad, steps, 4)).toThrow(StoredPayloadError);
    expect(seen).toEqual([2, 3]);
  });

  it('never changes the stored object it was given', () => {
    const stored = { inputs: { a: 1 }, assumptions: {} };
    const steps = {
      1: ((p) => {
        (p.inputs as { a: number }).a = 2;
        return p;
      }) as UpgradeStep,
    };
    expect(() => upgradeStored(1, stored, steps, 2)).toThrow();
    expect(stored.inputs.a).toBe(1);
  });

  it('refuses payloads it cannot read', () => {
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return (e as StoredPayloadError).code;
      }
      return null;
    };
    expect(code(() => upgradeStored(3, bad, {}, 2))).toBe('NEWER_THAN_APP');
    expect(code(() => upgradeStored(1, bad, {}, 2))).toBe('NO_UPGRADE');
    expect(code(() => upgradeStored(0, bad))).toBe('INVALID');
    expect(code(() => upgradeStored(1, bad))).toBe('INVALID');
  });
});

/** The parts of a version 1 payload that changed shape; the engine tests the full v1 fixture. */
const v1 = () => ({
  inputs: { detail: { data: { feed: [1, 1, 0], columns: 140, dq: 24, scd: 1 } } },
  assumptions: { dataDesign: 10, dataExec: 5, dataCycles: 3, dataPrepHours: 2 },
});

describe('version 1 → 2: sized data-platform assumptions (ADR-0019)', () => {
  it('copies each old single value to every size and counts columns and DQ rules as Simple', () => {
    expect(expandLegacyDataShapes(v1())).toEqual({
      inputs: {
        detail: { data: { feed: [1, 1, 0], columns: [140, 0, 0], dq: [24, 0, 0], scd: 1 } },
      },
      assumptions: {
        dataDesign: [10, 10, 10],
        dataExec: [5, 5, 5],
        dataCycles: 3,
        dataPrepHours: [2, 2, 2],
      },
    });
  });

  it('is idempotent and leaves payloads already in the new shape alone', () => {
    const once = expandLegacyDataShapes(v1());
    const twice = expandLegacyDataShapes(JSON.parse(JSON.stringify(once)) as typeof once);
    expect(twice).toEqual(once);
  });

  it('tolerates payloads without a data block', () => {
    const p = { inputs: { detail: {} }, assumptions: {} };
    expect(expandLegacyDataShapes({ inputs: { detail: {} }, assumptions: {} })).toEqual(p);
    expect(expandLegacyDataShapes({ inputs: null, assumptions: null })).toEqual({
      inputs: null,
      assumptions: null,
    });
  });
});

describe('version 2 → 3: ten feature sizes (ADR-0020)', () => {
  const v2 = () => ({
    inputs: { features: [{ size: 'XL' }] },
    assumptions: {
      proxies: { S: { screen: 9 }, M: {}, L: {}, XL: {} },
      dproxies: { S: {}, M: {}, L: {}, XL: {} },
      aproxies: { S: {}, M: {}, L: {}, XL: {} },
      ptRoughScen: { S: 4, M: 2, L: 3, XL: 5 },
    },
  });

  it('adds the six new sizes at their defaults and keeps every existing value', () => {
    const { assumptions } = addFeatureSizes(v2()) as {
      assumptions: Record<string, Record<string, unknown>>;
    };
    for (const group of ['proxies', 'dproxies', 'aproxies', 'ptRoughScen'] as const) {
      expect(Object.keys(assumptions[group]!).sort()).toEqual(
        ['XXS', 'XS', 'S', 'M-', 'M', 'M+', 'L', 'XL', 'XXL', 'XXXL'].sort(),
      );
      for (const size of ['XXS', 'XS', 'M-', 'M+', 'XXL', 'XXXL'] as const)
        expect(assumptions[group]![size]).toEqual(NEW_FEATURE_SIZE_DEFAULTS[group][size]);
    }
    expect(assumptions.proxies!.S).toEqual({ screen: 9 });
    expect(assumptions.ptRoughScen!.S).toBe(4);
  });

  it('never overwrites a size that is already there, so it is safe to run twice', () => {
    const once = addFeatureSizes(v2());
    const custom = JSON.parse(JSON.stringify(once)) as typeof once;
    (custom.assumptions as { ptRoughScen: Record<string, number> }).ptRoughScen.XXL = 99;
    expect(addFeatureSizes(JSON.parse(JSON.stringify(custom)) as typeof custom)).toEqual(custom);
    expect(addFeatureSizes({ inputs: null, assumptions: null })).toEqual({
      inputs: null,
      assumptions: null,
    });
  });
});

describe('version 3 → 4: sizes become an ordered list (custom sizes)', () => {
  const v3 = () => ({
    inputs: { features: [{ size: 'M' }] },
    assumptions: {
      // jsonb returns keys sorted by length then bytes, not in size order
      proxies: { L: {}, M: {}, S: {}, XL: {}, XS: {}, 'M+': {}, 'M-': {}, XXL: {}, XXS: {}, XXXL: {} },
      dproxies: {},
      aproxies: {},
      ptRoughScen: {},
    },
  });

  it('lists the sizes in the built-in order and adds empty notes', () => {
    const { assumptions } = addSizeList(v3()) as { assumptions: Record<string, unknown> };
    expect(assumptions.sizes).toEqual(['XXS', 'XS', 'S', 'M-', 'M', 'M+', 'L', 'XL', 'XXL', 'XXXL']);
    expect(assumptions.sizeNotes).toEqual({});
  });

  it('keeps only the sizes that are in the tables', () => {
    const p = v3();
    p.assumptions.proxies = { M: {}, S: {} } as typeof p.assumptions.proxies;
    expect((addSizeList(p).assumptions as { sizes: string[] }).sizes).toEqual(['S', 'M']);
  });

  it('leaves a payload that already has a size list alone', () => {
    const p = { inputs: {}, assumptions: { sizes: ['B', 'A'], sizeNotes: { x: 1 }, proxies: {} } };
    expect(addSizeList(structuredClone(p))).toEqual(p);
    expect(addSizeList({ inputs: null, assumptions: null })).toEqual({ inputs: null, assumptions: null });
  });

  it('is the step from version 3', () => {
    expect(INPUTS_SCHEMA_VERSION).toBe(4);
    expect(UPGRADES[3]).toBe(addSizeList);
  });
});
