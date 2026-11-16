import { describe, expect, it } from 'vitest';
import { SizeName } from './common';

describe('SizeName (custom sizes)', () => {
  it('accepts built-in and custom names of 1 to 6 characters', () => {
    for (const n of ['S', 'M-', 'M+', 'XXXL', 'XS2', 'Tiny'])
      expect(SizeName.safeParse(n).success).toBe(true);
  });

  it('trims the name', () => {
    expect(SizeName.parse('  XS2 ')).toBe('XS2');
  });

  it('refuses a dot, a space inside, an empty name and names longer than 6', () => {
    for (const n of ['M.1', 'X S', '', '   ', 'SEVENSS'])
      expect(SizeName.safeParse(n).success).toBe(false);
  });
});
