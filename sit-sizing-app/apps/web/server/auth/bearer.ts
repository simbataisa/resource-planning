import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { getEnv } from '../env';
import { logger } from '../logger';
import { rewriteToInternal } from './oidc';

/**
 * Keycloak access tokens sent as `Authorization: Bearer` by the MCP server (ADR-0016,
 * design spec 6.2). Only the signature, issuer, audience and expiry are trusted; roles
 * still come from the app's memberships. The token is never logged or stored.
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
/**
 * Clients whose tokens are never accepted, whatever their audience: Keycloak's built-in
 * clients (admin-cli allows the password grant by default) and the web app's own client,
 * whose tokens are never meant for this API. MCP clients are `sit-sizing-mcp` or
 * self-registered ones with generated IDs (ADR-0016).
 */
export const REFUSED_CLIENTS: ReadonlySet<string> = new Set([
  'admin-cli',
  'account',
  'account-console',
  'security-admin-console',
  'broker',
  'realm-management',
  'sit-sizing-web',
]);
/** Allowed clock difference between Keycloak and this app. */
const CLOCK_TOLERANCE_SECONDS = 30;

/**
 * The realm's key set could not be fetched or read, so the token was not judged either
 * way. The caller answers 503 NOT_READY, not 401: signing in again cannot help, and a
 * challenge would send the client round a sign-in loop.
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

export interface VerifiedToken {
  sub: string;
  sid: string;
  azp: string;
}

let remote: { issuer: string; keys: JWTVerifyGetKey } | undefined;
let keysForTests: JWTVerifyGetKey | undefined;

/** Integration tests only: verify against a local key set instead of Keycloak's JWKS. */
export function setKeysForTests(keys: JWTVerifyGetKey | undefined): void {
  if (process.env.NODE_ENV === 'production') throw new Error('setKeysForTests is for tests only');
  keysForTests = keys;
}

/** Realm signing keys, fetched from the internal IdP URL when set, and cached by jose. */
function realmKeys(issuer: string, internalBase: string | undefined): JWTVerifyGetKey {
  if (remote?.issuer !== issuer) {
    const url = rewriteToInternal(`${issuer}/protocol/openid-connect/certs`, issuer, internalBase);
    remote = { issuer, keys: createRemoteJWKSet(new URL(url)) };
  }
  return remote.keys;
}

/** True when this deployment accepts bearer tokens at all (OIDC sign-in configured). */
export function bearerEnabled(): boolean {
  const env = getEnv();
  return env.AUTH_MODE === 'oidc' && Boolean(env.OIDC_ISSUER);
}

/**
 * Verifies a Keycloak access token. Returns the identity claims, or null on any failure
 * (bad signature, wrong issuer or audience, expired, malformed, missing `sub`, `azp` or
 * `sid`, or minted by a refused client). Without `sid` the revocation check could not run,
 * so such a token is refused (fail closed). Throws `KeySetUnavailable` when the realm's
 * key set cannot be fetched.
 */
export async function verifyAccessToken(
  token: string,
  opts: { keys?: JWTVerifyGetKey; now?: Date } = {},
): Promise<VerifiedToken | null> {
  const env = getEnv();
  if (!env.OIDC_ISSUER || !token) return null;
  const keys = opts.keys ?? keysForTests ?? realmKeys(env.OIDC_ISSUER, env.OIDC_INTERNAL_URL);
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: env.OIDC_ISSUER,
      audience: env.OIDC_API_AUDIENCE,
      algorithms: ALGORITHMS,
      requiredClaims: ['exp', 'sub'],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      ...(opts.now ? { currentDate: opts.now } : {}),
    });
    const { sub, sid, azp, typ } = payload as Record<string, unknown>;
    if (typeof sub !== 'string' || !sub || typeof azp !== 'string' || !azp) return null;
    if (typeof sid !== 'string' || !sid) return null;
    if (REFUSED_CLIENTS.has(azp)) return null;
    // Keycloak marks access tokens typ=Bearer; ID, refresh and logout tokens are refused.
    if (typ !== undefined && typ !== 'Bearer') return null;
    return { sub, sid, azp };
  } catch (err) {
    // A refused token is routine and stays silent: the error can quote token content.
    // Only an unreachable or broken key set is logged, by error code alone.
    if (keySetUnavailable(err)) {
      const code = (err as { code?: unknown } | null)?.code;
      logger.warn(
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
