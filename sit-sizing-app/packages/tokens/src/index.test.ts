import { describe, expect, it } from 'vitest';
import { cssVar, tokenNames } from './index';

describe('tokens', () => {
  it('maps token names to CSS custom properties', () => {
    expect(cssVar('color.accent-ink')).toBe('--color-accent-ink');
  });

  it('has unique names', () => {
    expect(new Set(tokenNames).size).toBe(tokenNames.length);
  });
});
