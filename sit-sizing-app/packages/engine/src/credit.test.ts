import { describe, expect, it } from 'vitest';
import { applyCredit, credit } from './credit.ts';

describe('credit', () => {
  it.each([
    [100, 'sample'],
    [120, 'sample'],
    [99, 'partial'],
    [50, 'partial'],
    [49, 'full'],
    [0, 'full'],
    [Number.NaN, 'full'],
  ] as const)('%d%% → %s', (cov, state) => {
    expect(credit(cov)).toBe(state);
  });

  it('applies the state to a value', () => {
    expect(applyCredit('sample', 100, 7, 0.5)).toBe(7);
    expect(applyCredit('partial', 100, 7, 0.5)).toBe(50);
    expect(applyCredit('full', 100, 7, 0.5)).toBe(100);
  });
});
