import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from './defaults.ts';
import { expandLegacyDataShapes } from '@sit/schemas';
import {
  expandLegacyPrototype,
  fromPrototypeProfile,
  mergeShape,
  PrototypeImportError,
} from './prototype-import.ts';

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

  it('expands files saved before data-test sizes (ADR-0019) instead of dropping their values', () => {
    const { assumptions, inputs } = fromPrototypeProfile({
      assumptions: { dataDesign: 12, dataExec: 6, dataPrepHours: 1.5 },
      scope: { detail: { data: { columns: 90, dq: 7 } } },
    });
    expect(assumptions.dataDesign).toEqual([12, 12, 12]);
    expect(assumptions.dataExec).toEqual([6, 6, 6]);
    expect(assumptions.dataPrepHours).toEqual([1.5, 1.5, 1.5]);
    expect(inputs?.detail.data.columns).toEqual([90, 0, 0]);
    expect(inputs?.detail.data.dq).toEqual([7, 0, 0]);
  });

  it('expands legacy shapes exactly like the stored-payload upgrade', () => {
    const p = () => ({
      assumptions: { dataDesign: 9, dataExec: [1, 2, 3], dataPrepHours: 0 },
      inputs: { detail: { data: { columns: 5, dq: [1, 2, 3] } } },
    });
    expect(expandLegacyPrototype(p())).toEqual(expandLegacyDataShapes(p()));
    expect(expandLegacyPrototype({ assumptions: 1, inputs: null })).toEqual(
      expandLegacyDataShapes({ assumptions: 1, inputs: null }),
    );
  });

  it('normalises features like the prototype', () => {
    const { inputs } = fromPrototypeProfile({
      assumptions: {},
      scope: {
        features: [
          { name: '', size: 'XXXXL', cx: '7', qty: -2, type: 'x' },
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
