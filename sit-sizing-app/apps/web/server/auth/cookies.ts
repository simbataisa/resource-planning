/** Minimal cookie helpers (no dependency): parse a Cookie header and build Set-Cookie values. */

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const name = part.slice(0, i).trim();
    const raw = part.slice(i + 1).trim();
    if (!name || name in out) continue;
    try {
      out[name] = decodeURIComponent(raw);
    } catch {
      out[name] = raw;
    }
  }
  return out;
}

export interface CookieOptions {
  maxAge?: number;
  path?: string;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict';
}

/** Set-Cookie value. Always HttpOnly; `__Host-` names require Secure and Path=/. */
export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${opts.path ?? '/'}`,
    'HttpOnly',
    `SameSite=${opts.sameSite ?? 'Lax'}`,
  ];
  if (opts.secure) parts.push('Secure');
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`);
  return parts.join('; ');
}

export function clearCookie(name: string, opts: Omit<CookieOptions, 'maxAge'> = {}): string {
  return serializeCookie(name, '', { ...opts, maxAge: 0 });
}
