import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { McpEnv } from './env';

/**
 * Access-token check for the MCP endpoint (ADR-0016, design spec 6.2). It mirrors the
 * API's check in `apps/web/server/auth/bearer.ts`; the two apps share no code. The API
 * checks the token again on every call, including the `azp` deny-list, which is not
 * repeated here: every tool call makes at least one API call (`GET /me`, see `defineTool`),
 * so the API enforces it on every tool call. The token is never logged or stored.
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
 * expiry, `typ` Bearer when present, and `sub` and `sid` present. Returns the subject or
 * null on any failure.
 */
export async function verifyAccessToken(
  token: string,
  env: McpEnv,
  opts: { keys?: JWTVerifyGetKey; now?: Date; log?: WarnLog } = {},
): Promise<{ sub: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, opts.keys ?? realmKeys(env), {
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
    const code = (err as { code?: unknown } | null)?.code;
    if (code === 'ERR_JWKS_TIMEOUT' || code === 'ERR_JWKS_INVALID' || !code) {
      opts.log?.warn(
        { code: typeof code === 'string' ? code : 'JWKS_FETCH_FAILED' },
        'bearer key set unavailable',
      );
    }
    return null;
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
