import { NextResponse, type NextRequest } from 'next/server';
import { clearCookie, serializeCookie } from '@/server/auth/cookies';
import { keycloakRefresh, updateSession } from '@/server/auth/refresh';
import { cookieNames, nowSeconds, openSession, sealSession } from '@/server/auth/session';
import { getEnv } from '@/server/env';
import { LOCALE_COOKIE, LOCALES, localeRedirect, pickLocale } from '@/lib/i18n';

/**
 * Next.js 16 request proxy (formerly middleware), Node runtime.
 * - Every request carries an `x-request-id` (design 12.6).
 * - Keeps the app session alive: refresh with Keycloak every access-token lifetime, idle and
 *   absolute limits; ends the session when Keycloak says so (design 10.4, 10.5).
 * - Pages need a session (redirect to sign-in). API routes answer 401 themselves.
 * - Pages live under `/{locale}` (design 8.5); a path without one is redirected.
 */
const REQUEST_ID = 'x-request-id';
const VALID_ID = /^[A-Za-z0-9._:-]{8,128}$/;
/** Keycloak returns to /signed-out after sign-out (registered redirect URI); it is public. */
const isPublicPage = (pathname: string) =>
  pathname === '/signed-out' || LOCALES.some((l) => pathname === `/${l}/signed-out`);

export async function proxy(request: NextRequest) {
  const incoming = request.headers.get(REQUEST_ID);
  const requestId = incoming && VALID_ID.test(incoming) ? incoming : crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID, requestId);

  const env = getEnv();
  const { pathname, search } = request.nextUrl;
  const names = cookieNames(env.APP_BASE_URL);
  const setCookies: string[] = [];
  let signedIn = false;

  if (env.SESSION_SECRET && !pathname.startsWith('/api/auth/')) {
    const token = request.cookies.get(names.session)?.value;
    const session = await openSession(token, env.SESSION_SECRET, nowSeconds());
    if (token && !session) {
      setCookies.push(clearCookie(names.session, { secure: names.secure }));
    } else if (session) {
      const update = await updateSession(session, nowSeconds(), keycloakRefresh);
      if (update.kind === 'end') {
        setCookies.push(clearCookie(names.session, { secure: names.secure }));
      } else {
        signedIn = true;
        if (update.kind === 'update') {
          const sealed = await sealSession(update.session, env.SESSION_SECRET);
          setCookies.push(
            serializeCookie(names.session, sealed, {
              secure: names.secure,
              maxAge: update.session.expiresAt - nowSeconds(),
            }),
          );
          // Route handlers in this request see the fresh cookie.
          const others = request.cookies.getAll().filter((c) => c.name !== names.session);
          headers.set(
            'cookie',
            [
              ...others.map((c) => `${c.name}=${encodeURIComponent(c.value)}`),
              `${names.session}=${encodeURIComponent(sealed)}`,
            ].join('; '),
          );
        }
      }
      if (!signedIn)
        headers.set(
          'cookie',
          request.cookies
            .getAll()
            .filter((c) => c.name !== names.session)
            .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
            .join('; '),
        );
    }
  }

  // The API reference is a page for people, so it redirects to sign-in too.
  const isPage =
    (!pathname.startsWith('/api/') || pathname === '/api/v1/docs') && !isPublicPage(pathname);
  const signInAvailable = Boolean(env.OIDC_ISSUER && env.SESSION_SECRET);
  const devBypass = env.AUTH_MODE === 'dev' && Boolean(request.cookies.get('sit-dev-user')?.value);
  let response: NextResponse;
  if (isPage && signInAvailable && !signedIn && !devBypass) {
    const signin = new URL('/api/auth/signin', env.APP_BASE_URL);
    signin.searchParams.set('next', `${pathname}${search}`);
    response = NextResponse.redirect(signin);
  } else {
    const target = isPage
      ? localeRedirect(
          pathname,
          pickLocale(
            request.cookies.get(LOCALE_COOKIE)?.value,
            request.headers.get('accept-language'),
          ),
        )
      : null;
    response = target
      ? NextResponse.redirect(new URL(`${target}${search}`, env.APP_BASE_URL))
      : NextResponse.next({ request: { headers } });
  }
  response.headers.set(REQUEST_ID, requestId);
  for (const c of setCookies) response.headers.append('set-cookie', c);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|vendor/).*)'],
};
