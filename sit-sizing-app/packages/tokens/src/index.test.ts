import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  colorTokens,
  contrastExceptions,
  contrastPairs,
  nonTextPairs,
  contrastRatio,
  cssVar,
  luminance,
  tokensCss,
} from './index.ts';

describe('tokens', () => {
  it('both themes define exactly the same colour tokens', () => {
    expect(Object.keys(colorTokens.dark).sort()).toEqual(Object.keys(colorTokens.light).sort());
  });

  it('every colour is #RRGGBB', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const [k, v] of Object.entries(colorTokens[theme]))
        expect(v, `${theme}.${k}`).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it.each(['light', 'dark'] as const)('%s theme: text pairs meet WCAG AA (4.5:1)', (theme) => {
    for (const [text, bg] of contrastPairs) {
      const ratio = contrastRatio(colorTokens[theme][text], colorTokens[theme][bg]);
      expect(ratio, `${theme}: ${text} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(['light', 'dark'] as const)('%s theme: approved exceptions still meet 3:1', (theme) => {
    for (const [text, bg] of contrastExceptions) {
      const ratio = contrastRatio(colorTokens[theme][text], colorTokens[theme][bg]);
      expect(ratio, `${theme}: ${text} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('an exception is never also listed as a 4.5:1 pair', () => {
    const key = ([a, b]: readonly [string, string]) => `${a}/${b}`;
    const strict = new Set(contrastPairs.map(key));
    expect(contrastExceptions.map(key).filter((k) => strict.has(k))).toEqual([]);
  });

  it.each(['light', 'dark'] as const)('%s theme: non-text parts meet 3:1', (theme) => {
    for (const [part, bg] of nonTextPairs) {
      const ratio = contrastRatio(colorTokens[theme][part], colorTokens[theme][bg]);
      expect(ratio, `${theme}: ${part} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('sidebar tokens exist and are covered by the contrast checks', () => {
    const pairs = contrastPairs.map(([a, b]) => `${a}/${b}`);
    expect(pairs).toContain('sidebar-foreground/sidebar');
    expect(pairs).toContain('sidebar-accent-foreground/sidebar-accent');
    expect(nonTextPairs.map(([a, b]) => `${a}/${b}`)).toContain('sidebar-ring/sidebar');
  });

  it('chart bars use the prototype green and are checked as interface parts', () => {
    expect(colorTokens.light['chart-good']).toBe('#1E8E4A');
    expect(nonTextPairs.map(([a, b]) => `${a}/${b}`)).toContain('chart-good/muted');
  });

  it('contrast maths matches known values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 10);
    expect(() => luminance('red')).toThrow();
  });

  it('committed tokens.css is up to date (run `pnpm --filter @sit/tokens build`)', () => {
    const committed = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
    expect(committed).toBe(tokensCss());
  });

  it('maps token names to CSS custom properties', () => {
    expect(cssVar('muted-foreground')).toBe('--muted-foreground');
  });
});
