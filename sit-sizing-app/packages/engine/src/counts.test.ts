import type { EstimateInputs } from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import { counts, fieldProfile } from './counts.ts';
import { DEFAULT_ASSUMPTIONS as A, EXAMPLE_INPUTS } from './defaults.ts';

const S = () => structuredClone(EXAMPLE_INPUTS) as EstimateInputs;

describe('counts', () => {
  it('expands rough features through size proxies by complexity', () => {
    const s = S();
    s.features = [{ name: 'Synthetic', size: 'M', cx: 2, qty: 2 }];
    const c = counts('rough', A, s);
    expect(c.api).toEqual([0, 0, A.proxies.M.api * 2]);
    expect(c.fields).toBe(A.proxies.M.field * 2);
    expect(c.critical).toBeCloseTo(A.proxies.M.rule * 2 * A.criticalShare, 10);
  });

  it('takes the maximum guardrail count across AI features (prototype behaviour)', () => {
    const s = S();
    s.features = [
      { name: 'a', type: 'ai', size: 'S', cx: 0, qty: 3 },
      { name: 'b', type: 'ai', size: 'XL', cx: 1, qty: 1 },
      { name: 'c', type: 'ai', size: 'L', cx: 1, qty: 0 },
    ];
    expect(counts('rough', A, s).ai.guard).toBe(Math.max(A.aproxies.S.guard, A.aproxies.XL.guard));
  });

  it('adds data features to data counts and ignores quantity zero', () => {
    const s = S();
    s.features = [
      { name: 'd', type: 'data', size: 'S', cx: 1, qty: 2 },
      { name: 'e', type: 'data', size: 'L', cx: 0, qty: 0 },
    ];
    const c = counts('rough', A, s);
    expect(c.data.feed).toEqual([0, A.dproxies.S.feed * 2, 0]);
    expect(c.data.columns).toBe(A.dproxies.S.columns * 2);
    expect(c.data.accessRoles).toBe(s.roughRoles);
  });

  it('reads detailed counts as entered and clamps minimums', () => {
    const s = S();
    s.detail.languages = 0;
    s.detail.variants = 0;
    const c = counts('detailed', A, s);
    expect(c.api).toEqual(s.detail.api);
    expect(c.languages).toBe(1);
    expect(c.variants).toBe(1);
    expect(c.data).not.toBe(s.detail.data);
  });
});

describe('fieldProfile', () => {
  it('uses the typical mix when fields are not typed', () => {
    const fp = fieldProfile('detailed', A, S());
    expect(fp.typed).toBe(false);
    expect(fp.count).toBeNull();
    expect(fp.per).toBeGreaterThan(0);
  });

  it('uses the typed average when field types are entered (detailed only)', () => {
    const s = S();
    s.detail.fieldTypes.text = 3;
    s.detail.fieldTypes.boolean = 1;
    const fp = fieldProfile('detailed', A, s);
    expect(fp).toEqual({
      typed: true,
      count: 4,
      per: (3 * A.ftypes.text.cases + A.ftypes.boolean.cases) / 4,
    });
    expect(fieldProfile('rough', A, s).typed).toBe(false);
  });
});
