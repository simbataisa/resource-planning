import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { McpEnv } from './env';

/**
 * Access-token check for the MCP endpoint (ADR-0016, design spec 6.2). It mirrors the
 * API's check in `apps/web/server/auth/bearer.ts`; the two apps share no code. The API
 * checks the token again on every call, including the `azp` deny-list, which is not
 * repeated here: every tool call first awaits `GET /me` (see `defineTool`), and any refusal
 * there (401 as an auth challenge; 403, 429 or 5xx as a tool error) stops the call, so the
 * API authorises every tool call. The token is never logged or stored.
 */

/** Asymmetric algorithms only: no `none`, no HMAC (a public JWKS cannot verify those safely). */
const ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
];
/** Allowed clock difference between Keycloak and this server (same as the API). */
const CLOCK_TOLERANCE_SECONDS = 30;
export const METADATA_PATH = '/.well-known/oauth-protected-resource';
/** The MCP endpoint path; the protected resource identifier is the public URL plus this. */
export const MCP_PATH = '/mcp';
/**
 * Scopes a client should ask for (ADR-0016). Without this list some clients ask for every
 * scope the realm advertises, and the anonymous "Allowed Client Scopes" policy refuses them.
 */
export const SCOPES_SUPPORTED = ['openid', 'profile', 'email'];

const publicOrigin = (env: McpEnv) => env.MCP_PUBLIC_URL.replace(/\/$/, '');

interface WarnLog {
  warn(obj: object, msg?: string): void;
}

/**
 * The realm's key set could not be fetched or read, so the token could not be checked
 * either way. The HTTP layer answers 503, not a 401 challenge: signing in again cannot
 * help, and a challenge would send the client round a sign-in loop.
 */
export class KeySetUnavailable extends Error {
  constructor() {
    super('Token signing keys are unavailable');
    this.name = 'KeySetUnavailable';
  }
}

/**
 * Whether a verification error means the key set itself could not be fetched or read.
 * Pinned to jose 6.2.x (`jwks/remote.js`); re-check on a jose upgrade:
 * - `ERR_JWKS_TIMEOUT`: the key set request timed out;
 * - `ERR_JOSE_GENERIC`: a non-200 answer or a body that is not JSON (jose throws this code
 *   only there);
 * - `ERR_JWKS_INVALID`: the answer is not a key set;
 * - Node fetch's `TypeError: fetch failed`: the IdP is unreachable (network, DNS, TLS).
 * `ERR_JWKS_NO_MATCHING_KEY` is about the token's `kid` (jose refetches the set first), so
 * it stays a refused token. Every other jose error (`ERR_…`) is a refused token too; an
 * error without a jose code is a bug and is rethrown, never treated as an outage.
 */
function keySetUnavailable(err: unknown): boolean {
  if (err instanceof TypeError) return err.message === 'fetch failed';
  const code = (err as { code?: unknown } | null)?.code;
  return code === 'ERR_JWKS_TIMEOUT' || code === 'ERR_JOSE_GENERIC' || code === 'ERR_JWKS_INVALID';
}

/** jose errors carry an `ERR_…` code; anything else is unexpected. */
const isJoseError = (err: unknown) =>
  typeof (err as { code?: unknown } | null)?.code === 'string' &&
  String((err as { code: string }).code).startsWith('ERR_');

let remote: { url: string; keys: JWTVerifyGetKey } | undefined;

/** Realm signing keys, fetched from the internal IdP origin when set, and cached by jose. */
function realmKeys(env: McpEnv): JWTVerifyGetKey {
  let url = `${env.OIDC_ISSUER}/protocol/openid-connect/certs`;
  if (env.OIDC_INTERNAL_URL) {
    const from = new URL(env.OIDC_ISSUER).origin;
    url = new URL(env.OIDC_INTERNAL_URL).origin + url.slice(from.length);
  }
  if (remote?.url !== url) remote = { url, keys: createRemoteJWKSet(new URL(url)) };
  return remote.keys;
}

/**
 * Verifies a Keycloak access token: signature, issuer, audience `OIDC_API_AUDIENCE`,
 * expiry, `typ` Bearer when present, and `sub` and `sid` present. Returns the subject, or
 * null when the token is refused. Throws `KeySetUnavailable` when the key set cannot be
 * fetched, since the token was then not judged at all.
 */
export async function verifyAccessToken(
  token: string,
  env: McpEnv,
  opts: { keys?: JWTVerifyGetKey; now?: Date; log?: WarnLog } = {},
): Promise<{ sub: string } | null> {
  if (!token) return null;
  // Outside the try: a broken key set URL is a configuration bug, not an outage.
  const keys = opts.keys ?? realmKeys(env);
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: env.OIDC_ISSUER,
      audience: env.OIDC_API_AUDIENCE,
      algorithms: ALGORITHMS,
      requiredClaims: ['exp', 'sub'],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      ...(opts.now ? { currentDate: opts.now } : {}),
    });
    const { sub, sid, typ } = payload as Record<string, unknown>;
    if (typeof sub !== 'string' || !sub) return null;
    // Without `sid` the API cannot check revocation, so it refuses such tokens: so do we.
    if (typeof sid !== 'string' || !sid) return null;
    // Keycloak marks access tokens typ=Bearer; ID, refresh and logout tokens are refused.
    if (typ !== undefined && typ !== 'Bearer') return null;
    return { sub };
  } catch (err) {
    // A refused token is routine and stays silent: the error can quote token content.
    // Only an unreachable or broken key set is logged, by error code alone.
    if (keySetUnavailable(err)) {
      const code = (err as { code?: unknown } | null)?.code;
      opts.log?.warn(
        { code: typeof code === 'string' ? code : 'JWKS_FETCH_FAILED' },
        'bearer key set unavailable',
      );
      throw new KeySetUnavailable();
    }
    if (isJoseError(err)) return null;
    // Not a token problem nor an outage: a bug. Rethrow (500); the token is not accepted.
    throw err;
  }
}

/**
 * RFC 9728 protected resource metadata, served at `/.well-known/oauth-protected-resource`
 * (named in the challenge) and at its path-aware form `…/oauth-protected-resource/mcp`.
 * `resource` is the URL clients connect to, as RFC 9728 3.3 requires.
 */
export function protectedResourceMetadata(env: McpEnv) {
  return {
    resource: `${publicOrigin(env)}${MCP_PATH}`,
    authorization_servers: [env.OIDC_ISSUER],
    bearer_methods_supported: ['header'],
    scopes_supported: SCOPES_SUPPORTED,
  };
}

/** The `WWW-Authenticate` value of a 401 (RFC 6750 and the MCP authorization spec). */
export function challengeHeader(env: McpEnv, error?: 'invalid_token'): string {
  const metadata = `resource_metadata="${publicOrigin(env)}${METADATA_PATH}"`;
  return error ? `Bearer error="${error}", ${metadata}` : `Bearer ${metadata}`;
}

/** The token of an `Authorization: Bearer …` header, or null. */
export function bearerFromHeader(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
  return match?.[1] ?? null;
}
