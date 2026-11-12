import { clearCookie, parseCookies } from '@/server/auth/cookies';
import { client, oidcConfig, oidcConfigured } from '@/server/auth/oidc';
import { cookieNames, nowSeconds, openSession } from '@/server/auth/session';
import { getEnv } from '@/server/env';
import { route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

/**
 * Clears the app session and ends the Keycloak SSO session (RP-initiated logout), which also
 * invalidates the refresh token. A GET so it works as a plain link under `form-action 'self'`.
 */
export const GET = route(async (request, { log }) => {
  const env = getEnv();
  const names = cookieNames(env.APP_BASE_URL);
  const signedOut = new URL('/signed-out', env.APP_BASE_URL).href;
  let location = signedOut;
  if (oidcConfigured()) {
    const session = await openSession(
      parseCookies(request.headers.get('cookie'))[names.session],
      env.SESSION_SECRET!,
      nowSeconds(),
    );
    try {
      const config = await oidcConfig();
      location = client.buildEndSessionUrl(config, {
        post_logout_redirect_uri: signedOut,
        client_id: env.OIDC_CLIENT_ID,
        ...(session ? { id_token_hint: session.idToken } : {}),
      }).href;
    } catch (err) {
      log.warn(
        { err: (err as Error).message },
        'end-session URL unavailable; signing out of the app only',
      );
    }
  }
  return new Response(null, {
    status: 302,
    headers: { location, 'set-cookie': clearCookie(names.session, { secure: names.secure }) },
  });
});
