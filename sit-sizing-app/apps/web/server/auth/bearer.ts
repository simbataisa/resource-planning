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
/** Allowed clock difference between Keycloak and this app. */
const CLOCK_TOLERANCE_SECONDS = 30;

export interface VerifiedToken {
  sub: string;
  sid?: string;
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
 * (bad signature, wrong issuer or audience, expired, malformed, missing `sub` or `azp`).
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
    // Keycloak marks access tokens typ=Bearer; ID, refresh and logout tokens are refused.
    if (typ !== undefined && typ !== 'Bearer') return null;
    return { sub, azp, ...(typeof sid === 'string' && sid ? { sid } : {}) };
  } catch (err) {
    // A refused token is routine and stays silent: the error can quote token content.
    // Only an unreachable or broken key set is logged, by error code alone.
    const code = (err as { code?: unknown } | null)?.code;
    if (code === 'ERR_JWKS_TIMEOUT' || code === 'ERR_JWKS_INVALID' || !code) {
      logger.warn(
        { code: typeof code === 'string' ? code : 'JWKS_FETCH_FAILED' },
        'bearer key set unavailable',
      );
    }
    return null;
  }
}
