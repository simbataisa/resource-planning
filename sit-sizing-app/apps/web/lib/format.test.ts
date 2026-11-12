import { describe, expect, it } from 'vitest';
import { formatDateTime, formatFte, formatInt, formatNumber, signed } from './format';

describe('formatting', () => {
  it('reproduces the prototype rounding', () => {
    expect(formatInt(1254.5)).toBe('1,255');
    expect(formatInt(-2.5)).toBe('-2'); // Math.round: ties toward +∞ (engine finding 1)
    expect(formatFte(11.84)).toBe('11.8');
    expect(formatFte(20.4567)).toBe('20.5');
    expect(formatNumber(3.14159, 2)).toBe('3.14');
  });

  it('prints signed deltas with a real minus sign', () => {
    expect(signed(1.04)).toBe('+1.0');
    expect(signed(-3.26)).toBe('−3.3');
    expect(signed(-12, formatInt)).toBe('−12');
  });

  it('formats dates per language', () => {
    const iso = '2026-11-12T07:05:00.000Z';
    expect(formatDateTime(iso, 'en')).toMatch(/2026/);
    expect(formatDateTime(iso, 'vi')).toMatch(/2026/);
  });
});
