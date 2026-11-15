import type { Principal, ProjectRole } from '@/lib/rbac';
import { db } from '../db';
import { getEnv } from '../env';
import { HttpError } from '../http/route';
import { bearerEnabled, verifyAccessToken } from './bearer';
import { bearerToken } from './bearer-header';
import { parseCookies } from './cookies';
import { isSessionRevoked } from './revocation';
import { cookieNames, nowSeconds, openSession } from './session';

export interface CurrentUser extends Principal {
  subject: string;
  email: string;
  displayName: string;
  locale: 'en' | 'vi';
  /** How the request was authenticated: `mcp` for every bearer token (ADR-0016), else `web`. */
  channel: 'web' | 'mcp';
}

export const DEV_USER_HEADER = 'x-dev-user';
/** Same as the header, for browsers (docs page, "try it"): `document.cookie = 'sit-dev-user=dev-estimator'`. */
export const DEV_USER_COOKIE = 'sit-dev-user';

/**
 * Who is calling (design 10.5: identity comes from the IdP, project roles from the app).
 *
 * 0. `Authorization: Bearer <Keycloak access token>` (MCP clients, ADR-0016). When present it
 *    is the only source: cookies and the dev header are ignored. Accepted only with
 *    AUTH_MODE=oidc. A token for someone with no active app user is refused with
 *    403 NOT_PROVISIONED; the bearer path never creates users (provision.ts does, at sign-in).
 * 1. The app session cookie set after Keycloak sign-in (ADR-0004). The proxy refreshes it;
 *    a session revoked by back-channel logout is refused.
 * 2. AUTH_MODE=dev only: a seeded user named in the `x-dev-user` header or `sit-dev-user`
 *    cookie. env.ts allows dev mode only when APP_ENV=local.
 */
export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  const token = bearerToken(request.headers.get('authorization'));
  if (token !== undefined) return userFromBearer(token);
  return currentUserFromCookies(
    parseCookies(request.headers.get('cookie')),
    request.headers.get(DEV_USER_HEADER),
  );
}

/** Same as getCurrentUser for server components, which have cookies but no Request. */
export async function currentUserFromCookies(
  cookies: Record<string, string | undefined>,
  devHeader?: string | null,
): Promise<CurrentUser | null> {
  const env = getEnv();
  if (env.SESSION_SECRET) {
    const session = await openSession(
      cookies[cookieNames(env.APP_BASE_URL).session],
      env.SESSION_SECRET,
      nowSeconds(),
    );
    // A Keycloak session ended by back-channel logout ends this app session too.
    if (session && !(await isSessionRevoked(session.sid))) {
      const user = await loadUser({ id: session.uid }, 'web');
      if (user && user.subject === session.sub) return user;
    }
  }
  if (env.AUTH_MODE === 'dev') {
    const subject = devHeader || cookies[DEV_USER_COOKIE];
    if (subject) return loadUser({ subject }, 'web');
  }
  return null;
}

async function userFromBearer(token: string): Promise<CurrentUser | null> {
  if (!bearerEnabled()) return null;
  const claims = await verifyAccessToken(token);
  if (!claims) return null;
  // A Keycloak session ended by back-channel logout ends its tokens here too.
  if (await isSessionRevoked(claims.sid)) return null;
  const user = await loadUser({ subject: claims.sub }, 'mcp');
  if (!user) {
    throw new HttpError(403, 'NOT_PROVISIONED', 'Sign in to SIT Sizing once in the browser first.');
  }
  return user;
}

export function loadUserBySubject(subject: string): Promise<CurrentUser | null> {
  return loadUser({ subject }, 'web');
}

async function loadUser(
  where: { id: string } | { subject: string },
  channel: CurrentUser['channel'],
): Promise<CurrentUser | null> {
  const user = await db().user.findUnique({
    where,
    include: { memberships: { select: { projectId: true, role: true } } },
  });
  if (!user || !user.active) return null;
  const memberships: Record<string, ProjectRole> = {};
  for (const m of user.memberships) memberships[m.projectId] = m.role;
  return {
    id: user.id,
    subject: user.subject,
    email: user.email,
    displayName: user.displayName,
    globalRole: user.globalRole,
    locale: user.locale === 'vi' ? 'vi' : 'en',
    memberships,
    channel,
  };
}
