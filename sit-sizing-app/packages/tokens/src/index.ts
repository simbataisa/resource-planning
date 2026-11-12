/**
 * @sit/tokens — TCB-DS design tokens.
 *
 * Placeholder until step 1.4 (U-01). The token names below are the contract the
 * component layers will use; values are neutral stand-ins, not TCB-DS values.
 * Replace them from the TCB-DS source once open question Q1 is answered.
 */
export const tokenNames = [
  'color.bg',
  'color.surface',
  'color.text',
  'color.muted',
  'color.line',
  'color.accent',
  'color.accent-ink',
  'radius.md',
  'space.4',
] as const;

export type TokenName = (typeof tokenNames)[number];

/** CSS custom property for a token: `color.accent` → `--color-accent`. */
export function cssVar(name: TokenName): `--${string}` {
  return `--${name.replace(/\./g, '-')}`;
}
