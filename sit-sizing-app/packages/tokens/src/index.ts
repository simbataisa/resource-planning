/**
 * @sit/tokens — design tokens (U-01). Source of truth is src/tokens.ts; tokens.css is
 * generated from it (`pnpm --filter @sit/tokens build`) and imported by the web app.
 */
export {
  colorTokens,
  contrastPairs,
  motion,
  scaleTokens,
  type ColorToken,
  type ScaleToken,
  type Theme,
} from './tokens.ts';
export { tokensCss } from './css.ts';
export { contrastRatio, luminance } from './contrast.ts';

/** CSS custom property for a token: `muted-foreground` → `--muted-foreground`. */
export function cssVar(name: string): `--${string}` {
  return `--${name.replace(/\./g, '-')}`;
}
