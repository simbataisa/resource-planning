import { colorTokens, scaleTokens, type Theme } from './tokens.ts';

const block = (selector: string, vars: Record<string, string>, indent = '') =>
  `${indent}${selector} {\n${Object.entries(vars)
    .map(([k, v]) => `${indent}  --${k}: ${v};`)
    .join('\n')}\n${indent}}`;

const colors = (t: Theme) => ({ ...colorTokens[t] }) as Record<string, string>;

/**
 * tokens.css: light by default, dark from the OS setting, and an explicit override with
 * `data-theme="light|dark"` on <html> (for a future theme switch).
 */
export function tokensCss(): string {
  return [
    '/* Generated from packages/tokens/src/tokens.ts by `pnpm --filter @sit/tokens build`. Do not edit. */',
    block(':root', {
      ...(scaleTokens as Record<string, string>),
      ...colors('light'),
      'color-scheme': 'light',
    }),
    '@media (prefers-color-scheme: dark) {',
    block(':root:not([data-theme="light"])', { ...colors('dark'), 'color-scheme': 'dark' }, '  '),
    '}',
    block(':root[data-theme="dark"]', { ...colors('dark'), 'color-scheme': 'dark' }),
    '',
  ].join('\n');
}
