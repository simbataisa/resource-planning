import { clearCookie, parseCookies, serializeCookie } from '@/server/auth/cookies';
import { callbackUrl, client, oidcConfig, oidcConfigured } from '@/server/auth/oidc';
import { provisionUser } from '@/server/auth/provision';
import {
  ABSOLUTE_SECONDS,
  cookieNames,
  nowSeconds,
  openSignInTx,
  sealSession,
} from '@/server/auth/session';
import { getEnv } from '@/server/env';
import { errorResponse, route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

/**
 * Keycloak redirects here with the code. openid-client checks state, PKCE, the ID token
 * signature, issuer, audience and nonce; then the user is provisioned by `sub` and the
 * encrypted app session is set (design 10.3).
 */
export const GET = route(async (request, { requestId, log }) => {
  if (!oidcConfigured())
    return errorResponse(503, 'NOT_READY', 'Sign-in is not configured.', requestId);
  const env = getEnv();
  const names = cookieNames(env.APP_BASE_URL);
  const cookies = parseCookies(request.headers.get('cookie'));
  const tx = await openSignInTx(cookies[names.signIn], env.SESSION_SECRET!);
  if (!tx) {
    return errorResponse(
      400,
      'VALIDATION_FAILED',
      'The sign-in attempt expired. Please sign in again.',
      requestId,
    );
  }

  const config = await oidcConfig();
  let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>;
  try {
    tokens = await client.authorizationCodeGrant(config, callbackUrl(new URL(request.url).search), {
      pkceCodeVerifier: tx.verifier,
      expectedState: tx.state,
      expectedNonce: tx.nonce,
      idTokenExpected: true,
    });
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'sign-in callback rejected');
    return errorResponse(
      400,
      'VALIDATION_FAILED',
      'Sign-in could not be completed. Please try again.',
      requestId,
    );
  }

  const claims = tokens.claims();
  if (!claims?.sub || !tokens.id_token) {
    return errorResponse(
      400,
      'VALIDATION_FAILED',
      'Sign-in did not return an identity.',
      requestId,
    );
  }
  const user = await provisionUser(claims, requestId);
  if (!user)
    return errorResponse(403, 'FORBIDDEN', 'Your account is deactivated in this app.', requestId);

  const now = nowSeconds();
  const session = await sealSession(
    {
      uid: user.id,
      sub: claims.sub,
      ...(typeof claims.sid === 'string' && claims.sid ? { sid: claims.sid } : {}),
      idToken: tokens.id_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      refreshAt: now + Math.max(60, (tokens.expires_in ?? 600) - 60),
      lastSeen: now,
      expiresAt: now + ABSOLUTE_SECONDS,
    },
    env.SESSION_SECRET!,
  );
  const headers = new Headers({ location: new URL(tx.next, env.APP_BASE_URL).href });
  headers.append(
    'set-cookie',
    serializeCookie(names.session, session, { secure: names.secure, maxAge: ABSOLUTE_SECONDS }),
  );
  headers.append('set-cookie', clearCookie(names.signIn, { secure: names.secure }));
  log.info({ userId: user.id }, 'signed in');
  return new Response(null, { status: 302, headers });
});
