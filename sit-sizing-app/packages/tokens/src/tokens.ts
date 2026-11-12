/**
 * Design tokens (design 8, U-01). Interim values come from the HTML prototype's palette
 * (SIT_Sizing_Model.html), adjusted only where text failed WCAG AA contrast. They are
 * replaced from the official TCB-DS source once open question Q1 is answered; components
 * use the token names only, so a palette change never touches a component.
 *
 * Names follow shadcn/ui conventions (background, foreground, primary, …) plus domain
 * tokens for the estimate views (rough, detailed, good, warn, bad).
 */
export type Theme = 'light' | 'dark';

export const colorTokens = {
  light: {
    background: '#F5F6F8',
    foreground: '#212121',
    card: '#FFFFFF',
    'card-foreground': '#212121',
    popover: '#FFFFFF',
    'popover-foreground': '#212121',
    primary: '#1B1564',
    'primary-foreground': '#FFFFFF',
    secondary: '#F1F1F1',
    'secondary-foreground': '#212121',
    muted: '#F1F1F1',
    'muted-foreground': '#616161',
    accent: '#E3EEF0',
    'accent-foreground': '#1B1564',
    brand: '#ED1B24',
    'brand-foreground': '#FFFFFF',
    destructive: '#C8102E',
    'destructive-foreground': '#FFFFFF',
    border: '#DEDEDE',
    input: '#C4C4C4',
    ring: '#1B1564',
    rough: '#9A7B2F',
    'rough-soft': '#F6EEDC',
    'rough-foreground': '#7A5F1E',
    detailed: '#1B1564',
    'detailed-soft': '#E3EEF0',
    'detailed-foreground': '#1B1564',
    good: '#18733C',
    'good-soft': '#E5F6EB',
    warn: '#7A5F1E',
    'warn-soft': '#F6EEDC',
    bad: '#B3141B',
    'bad-soft': '#FDE8E9',
  },
  dark: {
    background: '#131313',
    foreground: '#F5F6F8',
    card: '#1C2629',
    'card-foreground': '#F5F6F8',
    popover: '#1C2629',
    'popover-foreground': '#F5F6F8',
    primary: '#9EA4FF',
    'primary-foreground': '#131313',
    secondary: '#263236',
    'secondary-foreground': '#F5F6F8',
    muted: '#263236',
    'muted-foreground': '#A2A2A2',
    accent: '#1F2440',
    'accent-foreground': '#9EA4FF',
    brand: '#FF3B42',
    'brand-foreground': '#131313',
    destructive: '#FF6B70',
    'destructive-foreground': '#131313',
    border: '#35424A',
    input: '#4A5A62',
    ring: '#9EA4FF',
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
  'font-body': "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  'font-code': "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
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
  ['primary-foreground', 'primary'],
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
];
