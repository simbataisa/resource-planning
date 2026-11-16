import { Assumptions } from '@sit/schemas';

import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS } from './defaults.ts';

const TABLES = ['proxies', 'dproxies', 'aproxies', 'ptRoughScen'] as const;
const clone = () => structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
const withSizes = (names: string[]) => {
  const a = clone();
  const tables = a as unknown as Record<string, Record<string, unknown>>;
  for (const t of TABLES)
    tables[t] = Object.fromEntries(names.map((n) => [n, structuredClone(tables[t]!.S)]));
  a.sizes = names;
  return a;
};
const paths = (a: unknown) => {
  const r = Assumptions.safeParse(a);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('Assumptions: sizes are an ordered list (custom sizes)', () => {
  it('has the ten built-in sizes in order and no notes by default', () => {
    expect(DEFAULT_ASSUMPTIONS.sizes).toEqual([
      'XXS',
      'XS',
      'S',
      'M-',
      'M',
      'M+',
      'L',
      'XL',
      'XXL',
      'XXXL',
    ]);
    expect(DEFAULT_ASSUMPTIONS.sizeNotes).toEqual({});
    expect(Assumptions.safeParse(DEFAULT_ASSUMPTIONS).success).toBe(true);
  });

  it('accepts a custom size', () => {
    expect(paths(withSizes(['S', 'XS2', 'M']))).toEqual([]);
  });

  it('refuses a size table whose keys differ from sizes', () => {
    const missing = withSizes(['S', 'M']);
    delete (missing.proxies as Record<string, unknown>).M;
    expect(paths(missing)).toContain('proxies');
    const extra = withSizes(['S', 'M']);
    (extra.ptRoughScen as Record<string, number>).L = 1;
    expect(paths(extra)).toContain('ptRoughScen');
  });

  it('refuses duplicate sizes', () => {
    const a = withSizes(['S', 'M']);
    a.sizes = ['S', 'M', 'S'];
    expect(paths(a)).toContain('sizes');
  });

  it('refuses no sizes and more than 20', () => {
    expect(paths(withSizes([]))).toContain('sizes');
    expect(paths(withSizes(Array.from({ length: 21 }, (_, i) => `Z${i}`)))).toContain('sizes');
    expect(paths(withSizes(Array.from({ length: 20 }, (_, i) => `Z${i}`)))).toEqual([]);
  });

  it('refuses a bad size name', () => {
    expect(paths(withSizes(['S', 'M.1'])).length).toBeGreaterThan(0);
  });
});
