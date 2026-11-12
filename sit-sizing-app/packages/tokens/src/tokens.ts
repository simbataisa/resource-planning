/**
 * Design tokens (design 8, U-01), from TCB-DS (`../tcb-ds`, open question Q1, ADR-0005).
 * TCB-DS was captured from the public techcombank.com site: white and mist-grey surfaces,
 * ink text, 1px pale-grey rules, 8px radius, black for strong actions and red only for
 * active or brand signals. Departures, each for WCAG 2.2 AA, are marked "AA:".
 * Rough (gold) and detailed (navy) stay as the prototype's chart series colours.
 *
 * Names follow shadcn/ui conventions (background, foreground, primary, …) plus domain
 * tokens for the estimate views (rough, detailed, good, warn, bad). Components use the names
 * only, so a palette change never touches a component.
 */
export type Theme = 'light' | 'dark';

export const colorTokens = {
  light: {
    background: '#F5F6F8', // mist grey: page canvas
    foreground: '#212121', // ink
    card: '#FFFFFF',
    'card-foreground': '#212121',
    popover: '#FFFFFF',
    'popover-foreground': '#212121',
    primary: '#212121', // strong actions are black
    'primary-foreground': '#FFFFFF',
    secondary: '#F2F2F2', // fill-secondary
    'secondary-foreground': '#212121',
    muted: '#F2F2F2',
    'muted-foreground': '#616161', // secondary grey
    accent: '#FFEDEB', // primary-bg: quiet red-tinted hover and selection
    'accent-foreground': '#7A0011', // primary-text
    brand: '#ED1C24', // pink red: active markers, highlights (not behind text)
    'brand-foreground': '#FFFFFF',
    destructive: '#C70E1B', // primary-active. AA: #ED1C24 with white text is 4.0:1
    'destructive-foreground': '#FFFFFF',
    border: '#DEDEDE', // light border
    input: '#8C8C8C', // AA: form-field outline needs 3:1 against white (TCB-DS #DEDEDE is 1.3:1)
    ring: '#ED1C24', // focus: red signal, 4.0:1 against white (3:1 needed)
    rough: '#9A7B2F',
    'rough-soft': '#F6EEDC',
    'rough-foreground': '#7A5F1E',
    detailed: '#1B1564',
    'detailed-soft': '#E8E7F3',
    'detailed-foreground': '#1B1564',
    good: '#237804', // AA: TCB-DS success-active #389E0D is 3.9:1 on its background
    'good-soft': '#F6FFED', // success-bg
    warn: '#874D00', // AA: TCB-DS warning #FAAD14 is for icons, not text
    'warn-soft': '#FFFBE6', // warning-bg
    bad: '#C70E1B',
    'bad-soft': '#FFF2F0', // error-bg
  },
  dark: {
    background: '#141414', // bg-container
    foreground: '#DCDCDC', // text
    card: '#1D1D1D', // bg-layout
    'card-foreground': '#DCDCDC',
    popover: '#272727', // bg-elevated
    'popover-foreground': '#DCDCDC',
    primary: '#F5F5F5', // strong actions invert in dark
    'primary-foreground': '#141414',
    secondary: '#303030', // fill-secondary
    'secondary-foreground': '#DCDCDC',
    muted: '#303030',
    'muted-foreground': '#ADADAD', // text-secondary
    accent: '#2F1315', // primary-bg
    'accent-foreground': '#F8C3BD', // primary-text
    brand: '#D83F3F',
    'brand-foreground': '#141414',
    destructive: '#E86A67', // primary-hover; AA with dark text
    'destructive-foreground': '#141414',
    border: '#3E3E3E',
    input: '#7E7E7E', // AA: 3:1 against the card
    ring: '#E86A67',
    rough: '#D6B973',
    'rough-soft': '#2E2717',
    'rough-foreground': '#D6B973',
    detailed: '#9EA4FF',
    'detailed-soft': '#1F2440',
    'detailed-foreground': '#9EA4FF',
    good: '#87CA5C', // success-hover
    'good-soft': '#192913',
    warn: '#E8C35E', // warning-hover
    'warn-soft': '#312512',
    bad: '#E89590', // error-hover
    'bad-soft': '#32191A',
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
  // TCB-DS: 1px rules before elevation, so cards barely lift.
  'shadow-raised': '0 1px 2px rgb(0 0 0 / 0.06)',
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
  ['good', 'card'],
  ['warn', 'card'],
  ['bad', 'card'],
  ['destructive', 'card'],
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
