/**
 * Locales and locale choice (design 8.5). Client-safe and pure, so the proxy, the
 * server and components share one definition.
 */
export const LOCALES = ['en', 'vi'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
/** Remembers the language the user picked with the language switch. */
export const LOCALE_COOKIE = 'sit-locale';

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

/** The cookie wins; otherwise Vietnamese when the browser prefers it; otherwise English. */
export function pickLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  const first = acceptLanguage?.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('vi') ? 'vi' : DEFAULT_LOCALE;
}

/** The locale prefix of a page path, if any: `/vi/projects` → `vi`. */
export function localeOf(pathname: string): Locale | null {
  const first = pathname.split('/')[1];
  return isLocale(first) ? first : null;
}

/**
 * Where to send a page request that has no locale prefix, or null when it already has one.
 * API routes and Next.js internals are never redirected.
 */
export function localeRedirect(pathname: string, locale: Locale): string | null {
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return null;
  if (localeOf(pathname)) return null;
  return pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
}
