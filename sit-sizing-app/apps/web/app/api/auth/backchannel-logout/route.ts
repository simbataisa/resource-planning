import { createRemoteJWKSet } from 'jose';
import { LogoutTokenError, verifyLogoutToken } from '@/server/auth/backchannel';
import { oidcConfig, oidcConfigured, rewriteToInternal } from '@/server/auth/oidc';
import { revokeSession } from '@/server/auth/revocation';
import { getEnv } from '@/server/env';
import { errorResponse, route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
async function keys() {
  if (jwks) return jwks;
  const env = getEnv();
  const uri = (await oidcConfig()).serverMetadata().jwks_uri;
  if (!uri || !env.OIDC_ISSUER) throw new Error('the IdP publishes no jwks_uri');
  jwks = createRemoteJWKSet(
    new URL(rewriteToInternal(uri, env.OIDC_ISSUER, env.OIDC_INTERNAL_URL)),
  );
  return jwks;
}

/**
 * Back-channel logout (design 10.4): Keycloak posts a signed logout token here, server to
 * server, when a session ends. The app session that belongs to that Keycloak session is
 * refused from the next request on (server/auth/revocation.ts).
 */
export const POST = route(async (request, { requestId, log }) => {
  if (!oidcConfigured())
    return errorResponse(503, 'NOT_READY', 'Sign-in is not configured.', requestId);
  const form = await request.formData().catch(() => null);
  const token = form?.get('logout_token');
  if (typeof token !== 'string' || token === '')
    return errorResponse(400, 'VALIDATION_FAILED', 'logout_token is required.', requestId);
  const env = getEnv();
  try {
    const { sid } = await verifyLogoutToken(token, {
      getKey: await keys(),
      issuer: env.OIDC_ISSUER!,
      audience: env.OIDC_CLIENT_ID,
    });
    await revokeSession(sid);
    log.info('session ended by back-channel logout');
    return new Response(null, { status: 200, headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    if (!(err instanceof LogoutTokenError)) throw err;
    log.warn({ reason: err.message }, 'back-channel logout rejected');
    return errorResponse(400, 'VALIDATION_FAILED', 'The logout token is not valid.', requestId);
  }
});
