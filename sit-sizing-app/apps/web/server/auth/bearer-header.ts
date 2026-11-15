/**
 * The one place that decides whether a request carries a bearer token (ADR-0016).
 * No dependencies, so the route wrapper can use it without loading the OIDC code.
 */

/** The token of an `Authorization: Bearer` header ('' when empty), or undefined for no bearer. */
export function bearerToken(header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer(?:\s+(.*))?$/i.exec(header.trim());
  return match ? (match[1] ?? '').trim() : undefined;
}

/** True when the request has an `Authorization: Bearer` header, even with an empty token. */
export function isBearerRequest(request: Request): boolean {
  return bearerToken(request.headers.get('authorization')) !== undefined;
}
