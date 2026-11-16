import { DEFAULT_ASSUMPTIONS } from '@sit/engine';
import type { Assumptions } from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import { addSize, moveSize, removeSize, renameSize, type SizeEdit } from './profile-sizes';

const D = (): Assumptions => structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
const TABLES = ['proxies', 'dproxies', 'aproxies', 'ptRoughScen'] as const;
const note = { source: 'Synthetic pilot' };
const ok = (r: SizeEdit) => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

describe('addSize (ADR-0021)', () => {
  it('copies every table entry of the size it starts from and appends the name', () => {
    const { values } = ok(addSize(D(), {}, 'XS2', 'S'));
    expect(values.sizes.at(-1)).toBe('XS2');
    for (const t of TABLES)
      expect((values[t] as Record<string, unknown>).XS2).toEqual(
        (D()[t] as Record<string, unknown>).S,
      );
  });

  it('trims the name and refuses a bad, taken or 21st name', () => {
    expect(ok(addSize(D(), {}, ' XS2 ', 'S')).values.sizes).toContain('XS2');
    expect(addSize(D(), {}, 'M.1', 'S')).toEqual({ error: 'BAD_NAME' });
    expect(addSize(D(), {}, 'M', 'S')).toEqual({ error: 'NAME_TAKEN' });
    let v = D();
    for (let i = 0; i < 10; i++) v = ok(addSize(v, {}, `Z${i}`, 'S')).values;
    expect(addSize(v, {}, 'Z99', 'S')).toEqual({ error: 'TOO_MANY' });
  });

  it('never changes its input', () => {
    const v = D();
    addSize(v, {}, 'XS2', 'S');
    expect(v).toEqual(D());
  });
});

describe('renameSize (ADR-0021)', () => {
  it('moves the table entries and the notes to the new name, in place', () => {
    const { values, calibration } = ok(
      renameSize(D(), { 'proxies.M': note, 'dproxies.M': note, sampleFE: note }, 'M', 'Med'),
    );
    expect(values.sizes[values.sizes.indexOf('Med') - 1]).toBe('M-');
    expect(values.sizes).not.toContain('M');
    for (const t of TABLES)
      expect((values[t] as Record<string, unknown>).Med).toEqual(
        (D()[t] as Record<string, unknown>).M,
      );
    expect(calibration).toEqual({ 'proxies.Med': note, 'dproxies.Med': note, sampleFE: note });
  });

  it('refuses a name that is taken and changes nothing', () => {
    const v = D();
    expect(renameSize(v, {}, 'M', 'L')).toEqual({ error: 'NAME_TAKEN' });
    expect(v).toEqual(D());
  });
});

describe('removeSize (ADR-0021)', () => {
  it('drops the size and its notes, leaving no unknown note', () => {
    const { values, calibration } = ok(
      removeSize(D(), { 'proxies.XXL': note, sampleFE: note }, 'XXL'),
    );
    expect(values.sizes).not.toContain('XXL');
    for (const t of TABLES) expect((values[t] as Record<string, unknown>).XXL).toBeUndefined();
    expect(calibration).toEqual({ sampleFE: note });
  });

  it('refuses to remove the last size', () => {
    let v = D();
    for (const s of D().sizes.slice(1)) v = ok(removeSize(v, {}, s)).values;
    expect(v.sizes).toEqual(['XXS']);
    expect(removeSize(v, {}, 'XXS')).toEqual({ error: 'LAST_SIZE' });
  });
});

describe('moveSize (ADR-0021)', () => {
  it('swaps with the neighbour and is a no-op at either end', () => {
    expect(ok(moveSize(D(), {}, 'S', -1)).values.sizes.slice(0, 3)).toEqual(['XXS', 'S', 'XS']);
    expect(ok(moveSize(D(), {}, 'XXS', -1)).values.sizes).toEqual(D().sizes);
    expect(ok(moveSize(D(), {}, 'XXXL', 1)).values.sizes).toEqual(D().sizes);
  });
});

describe('built-in names (ADR-0021)', () => {
  it('re-adding a removed built-in size restores its engine defaults, so it stays uncalibrated', () => {
    const removed = ok(removeSize(D(), {}, 'XXL')).values;
    const { values } = ok(addSize(removed, {}, 'XXL', 'M'));
    for (const t of TABLES)
      expect((values[t] as Record<string, unknown>).XXL).toEqual(
        (D()[t] as Record<string, unknown>).XXL,
      );
  });

  it('refuses to rename a size to a built-in name', () => {
    const removed = ok(removeSize(D(), {}, 'XXL')).values;
    expect(renameSize(removed, {}, 'XL', 'XXL')).toEqual({ error: 'BUILT_IN_NAME' });
  });
});
