import { describe, expect, it } from 'vitest';
import {
  INPUTS_SCHEMA_VERSION,
  StoredPayloadError,
  UPGRADES,
  upgradeStored,
  type UpgradeStep,
} from './upgrade';

/** A minimal valid payload is not needed here: these tests check the chain, then validation. */
const bad = { inputs: { nope: true }, assumptions: {} };

describe('upgradeStored (E-08)', () => {
  it('starts at schema version 1 with no upgrade steps yet', () => {
    expect(INPUTS_SCHEMA_VERSION).toBe(1);
    expect(Object.keys(UPGRADES)).toEqual([]);
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
