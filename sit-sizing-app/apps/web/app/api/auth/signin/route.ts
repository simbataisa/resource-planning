import { serializeCookie } from '@/server/auth/cookies';
import { callbackUrl, client, oidcConfig, oidcConfigured, SCOPES } from '@/server/auth/oidc';
import { cookieNames, nowSeconds, safeNext, sealSignInTx } from '@/server/auth/session';
import { getEnv } from '@/server/env';
import { errorResponse, route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

/** Starts sign-in: PKCE (S256), state and nonce in a short-lived encrypted cookie, then Keycloak. */
export const GET = route(async (request, { requestId }) => {
  if (!oidcConfigured()) {
    return errorResponse(503, 'NOT_READY', 'Sign-in is not configured (OIDC_ISSUER).', requestId);
  }
  const env = getEnv();
  const config = await oidcConfig();
  const verifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const next = safeNext(new URL(request.url).searchParams.get('next'));
  const locale = request.headers.get('accept-language')?.toLowerCase().startsWith('vi')
    ? 'vi'
    : 'en';

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl().href,
    scope: SCOPES,
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256',
    state,
    nonce,
    ui_locales: locale,
  });

  const names = cookieNames(env.APP_BASE_URL);
  const tx = await sealSignInTx(
    { state, nonce, verifier, next },
    env.SESSION_SECRET!,
    nowSeconds(),
  );
  return new Response(null, {
    status: 302,
    headers: {
      location: url.href,
      'set-cookie': serializeCookie(names.signIn, tx, { secure: names.secure, maxAge: 600 }),
    },
  });
});
