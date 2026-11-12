/**
 * Content Security Policy (design 11, threat model T-07). A fresh nonce per request; scripts
 * run only with that nonce ('strict-dynamic' lets them load their own chunks). Next.js reads
 * the policy from the request header that proxy.ts sets and puts the nonce on its scripts.
 * Inline style attributes stay allowed: bars and meters set their width inline.
 */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export function buildCsp(nonce: string, opts: { dev: boolean }): string {
  return [
    "default-src 'self'",
    // 'unsafe-eval' only in development (React Refresh); never in a built image.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${opts.dev ? ' ws: wss:' : ''}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

/** Adds the nonce to every <script> tag of a server-rendered HTML page (the API reference). */
export function addNonceToScripts(html: string, nonce: string): string {
  return html.replace(/<script(?![^>]*\snonce=)/g, `<script nonce="${nonce}"`);
}
