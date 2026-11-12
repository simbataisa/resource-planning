/**
 * Number and date formatting. Numbers reproduce the prototype's rounding exactly so a user
 * sees the same figures as in the HTML file (step 1.5 exit criterion), and keep its `1,255`
 * and `11.8` style in both languages (design 8.5, open question Q6).
 */

/** Whole numbers with thousands separators (prototype `fmt`). */
export const formatInt = (n: number) => Math.round(n).toLocaleString('en-US');

/** One decimal (prototype `f1`): 11.8 */
export const formatFte = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** Up to `fractionDigits` decimals, whole numbers without a decimal point (prototype `num1`). */
export function formatNumber(n: number, fractionDigits = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** "+3.2" / "−1.0" with a real minus sign, as the prototype prints deltas. */
export const signed = (n: number, f: (v: number) => string = formatFte) =>
  `${n >= 0 ? '+' : '−'}${f(Math.abs(n))}`;

/** Date and time in the user's language, e.g. "12 Nov 2026, 14:05". */
export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/** Whole numbers as is, otherwise one decimal (prototype `num1`): 12 / 12.5 */
export const num1 = (n: number) =>
  Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : (Math.round(n * 10) / 10).toFixed(1);

/** A share 0–1 as a whole percentage (prototype `pctS`): 0.25 → "25%" */
export const pctS = (v: number) => `${Math.round(v * 100)}%`;
