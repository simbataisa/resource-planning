import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from './defaults.ts';
import { fromPrototypeProfile, mergeShape, PrototypeImportError } from './prototype-import.ts';

describe('mergeShape', () => {
  it('keeps the base shape and only takes matching types', () => {
    const base = { a: 1, b: [1, 2, 3], c: { d: 'x' }, e: true };
    expect(
      mergeShape(base, { a: 2, b: [4, Number.NaN, 6], c: { d: 'y', extra: 1 }, e: 'no', z: 9 }),
    ).toEqual({
      a: 2,
      b: [4, 2, 6],
      c: { d: 'y' },
      e: true,
    });
    expect(mergeShape(base, { b: [1, 2] }).b).toEqual([1, 2, 3]);
    expect(mergeShape(base, null)).toBe(base);
    expect(mergeShape(1, Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('fromPrototypeProfile', () => {
  it('rejects things that are not profiles', () => {
    expect(() => fromPrototypeProfile(null)).toThrow(PrototypeImportError);
    expect(() => fromPrototypeProfile({ scope: {} })).toThrow(/NO_ASSUMPTIONS/);
  });

  it('accepts the short "A" key and keeps defaults for missing values', () => {
    const { assumptions, inputs, profile } = fromPrototypeProfile({
      A: { overhead: 0.2 },
      profile: 'Synthetic team',
    });
    expect(assumptions.overhead).toBe(0.2);
    expect(assumptions.minutes).toEqual(DEFAULT_ASSUMPTIONS.minutes);
    expect(inputs).toBeNull();
    expect(profile).toBe('Synthetic team');
  });

  it('normalises features like the prototype', () => {
    const { inputs } = fromPrototypeProfile({
      assumptions: {},
      scope: {
        features: [
          { name: '', size: 'XXL', cx: '7', qty: -2, type: 'x' },
          null,
          { name: 'Ok', size: 'S', cx: '2', qty: '3', pt: 1 },
        ],
      },
    });
    expect(inputs!.features).toEqual([
      { name: 'Feature', pt: false, type: 'app', size: 'M', cx: 1, qty: 0 },
      { name: 'Ok', pt: true, type: 'app', size: 'S', cx: 2, qty: 3 },
    ]);
    expect(inputs!.team).toEqual(EXAMPLE_INPUTS.team);
  });

  it('keeps the example features when the scope has none', () => {
    const { inputs } = fromPrototypeProfile({ assumptions: {}, scope: { roughRoles: 9 } });
    expect(inputs!.features).toEqual(EXAMPLE_INPUTS.features);
    expect(inputs!.roughRoles).toBe(9);
  });
});
