/**
 * Design tokens (design 8, U-01). TCB-DS red `#ED1C24` (`../tcb-ds`, Q1) in the theme of the
 * HTML prototype (SIT_Sizing_Model.html): mist-grey page, white cards with 1px rules and a
 * soft shadow, red for primary actions, focus, the selected tab and caption labels, gold for
 * the rough estimate and navy for the detailed estimate. ADR-0005 records the decision.
 *
 * WCAG notes: values marked "AA:" are darker than the prototype so that status text reads at
 * 4.5:1. Red behind or as small text is an approved exception (see `contrastExceptions`).
 *
 * Names follow shadcn/ui conventions (background, foreground, primary, …) plus domain
 * tokens for the estimate views (rough, detailed, good, warn, bad). Components use the names
 * only, so a palette change never touches a component.
 */
export type Theme = 'light' | 'dark';

export const colorTokens = {
  light: {
    background: '#F5F6F8', // page grey
    foreground: '#212121', // ink
    card: '#FFFFFF',
    'card-foreground': '#212121',
    popover: '#FFFFFF',
    'popover-foreground': '#212121',
    primary: '#ED1C24', // TCB-DS red: primary actions, links
    'primary-foreground': '#FFFFFF',
    'primary-hover': '#C8141C', // the prototype's pressed red
    secondary: '#F1F1F1', // "sunk": fields, table heads, tracks
    'secondary-foreground': '#212121',
    muted: '#F1F1F1',
    'muted-foreground': '#616161',
    accent: '#F1F1F1', // hover surfaces
    'accent-foreground': '#212121',
    brand: '#ED1C24', // top bar, selected tab, caption labels, focus
    'brand-foreground': '#FFFFFF',
    destructive: '#C8141C',
    'destructive-foreground': '#FFFFFF',
    border: '#DEDEDE', // 1px rules
    'border-strong': '#C4C4C4', // totals rule, neutral card edge
    input: '#8C8C8C', // AA: field outline needs 3:1 (the prototype's #C4C4C4 is 1.7:1)
    ring: '#ED1C24',
    rough: '#9A7B2F', // gold: rough estimate
    'rough-soft': '#F6EEDC',
    'rough-foreground': '#7A5F1E',
    detailed: '#1B1564', // navy: detailed estimate
    'detailed-soft': '#E3EEF0',
    'detailed-foreground': '#1B1564',
    good: '#18733C', // AA: prototype #1E8E4A
    'good-soft': '#E5F6EB',
    warn: '#7A5F1E', // AA: prototype #9A7B2F
    'warn-soft': '#F6EEDC',
    bad: '#C8141C', // AA: prototype #ED1B24
    'bad-soft': '#FDE8E9',
  },
  dark: {
    background: '#131313',
    foreground: '#F5F6F8',
    card: '#1C2629',
    'card-foreground': '#F5F6F8',
    popover: '#1C2629',
    'popover-foreground': '#F5F6F8',
    primary: '#FF3B42',
    'primary-foreground': '#FFFFFF',
    'primary-hover': '#C8141C',
    secondary: '#263236',
    'secondary-foreground': '#F5F6F8',
    muted: '#263236',
    'muted-foreground': '#A2A2A2',
    accent: '#263236',
    'accent-foreground': '#F5F6F8',
    brand: '#FF3B42',
    'brand-foreground': '#FFFFFF',
    destructive: '#FF6B70',
    'destructive-foreground': '#131313',
    border: '#35424A',
    'border-strong': '#4A5A62',
    input: '#7C8F98', // AA: 3:1 against the card
    ring: '#FF3B42',
    rough: '#D6B973',
    'rough-soft': '#2E2717',
    'rough-foreground': '#D6B973',
    detailed: '#9EA4FF',
    'detailed-soft': '#1F2440',
    'detailed-foreground': '#9EA4FF',
    good: '#32C959',
    'good-soft': '#16301F',
    warn: '#D6B973',
    'warn-soft': '#2E2717',
    bad: '#FF6B70',
    'bad-soft': '#3A1C1E',
  },
} as const;

export type ColorToken = keyof (typeof colorTokens)['light'];

/**
 * Non-colour tokens, shared by both themes. Names avoid Tailwind's own theme variables
 * (--font-sans, --shadow-*, --ease-*) so the @theme mapping in globals.css cannot loop.
 */
export const scaleTokens = {
  radius: '0.5rem',
  // Local system fonts only (SF Pro on Apple devices); no web fonts are shipped (licence).
  'font-body':
    "-apple-system, 'SF Pro Text', 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif",
  'font-code': "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace",
  'shadow-raised': '0 2px 8px rgb(0 0 0 / 0.08)',
  'motion-fast': '120ms',
  'motion-base': '200ms',
  'motion-slow': '320ms',
  'motion-ease': 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export type ScaleToken = keyof typeof scaleTokens;

/** Motion durations in milliseconds, for anime.js (CSS uses the variables). */
export const motion = { fast: 120, base: 200, slow: 320 } as const;

/**
 * Text/background pairs that must meet WCAG 2.2 AA (4.5:1) in both themes.
 * Checked by tokens.test.ts; add a pair whenever a new text token is introduced.
 */
export const contrastPairs: readonly [text: ColorToken, background: ColorToken][] = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary-hover'],
  ['secondary-foreground', 'secondary'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['rough-foreground', 'rough-soft'],
  ['detailed-foreground', 'detailed-soft'],
  ['good', 'good-soft'],
  ['warn', 'warn-soft'],
  ['bad', 'bad-soft'],
  ['good', 'card'],
  ['warn', 'card'],
  ['bad', 'card'],
];

/**
 * Approved exceptions to 4.5:1 (product owner, 2026-11-12, ADR-0005): the TCB-DS red as the
 * prototype uses it, for button labels, links and caption labels. They must still reach 3:1
 * (the AA level for large text and interface parts). Keep this list short and explicit.
 */
export const contrastExceptions: readonly [text: ColorToken, background: ColorToken][] = [
  ['primary-foreground', 'primary'],
  ['primary', 'card'],
  ['primary', 'background'],
  ['brand', 'card'],
  ['brand', 'background'],
];

/**
 * Non-text pairs that must meet WCAG 2.2 AA 1.4.11 (3:1): field outlines, the focus ring and
 * the red active marker against the surfaces they sit on.
 */
export const nonTextPairs: readonly [part: ColorToken, background: ColorToken][] = [
  ['input', 'card'],
  ['input', 'background'],
  ['ring', 'card'],
  ['ring', 'background'],
  ['brand', 'card'],
  ['rough', 'card'],
  ['detailed', 'card'],
];
