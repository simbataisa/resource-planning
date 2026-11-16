import { describe, expect, it } from 'vitest';
import {
  INPUTS_SCHEMA_VERSION,
  expandLegacyDataShapes,
  StoredPayloadError,
  UPGRADES,
  upgradeStored,
  type UpgradeStep,
} from './upgrade';

/** A minimal valid payload is not needed here: these tests check the chain, then validation. */
const bad = { inputs: { nope: true }, assumptions: {} };

describe('upgradeStored (E-08)', () => {
  it('is at schema version 2, with one step from version 1 (ADR-0019)', () => {
    expect(INPUTS_SCHEMA_VERSION).toBe(2);
    expect(Object.keys(UPGRADES)).toEqual(['1']);
    expect(UPGRADES[1]).toBe(expandLegacyDataShapes);
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
