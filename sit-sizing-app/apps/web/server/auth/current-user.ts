import type { Principal, ProjectRole } from '@/lib/rbac';
import { db } from '../db';
import { getEnv } from '../env';
import { parseCookies } from './cookies';
import { cookieNames, nowSeconds, openSession } from './session';

export interface CurrentUser extends Principal {
  subject: string;
  email: string;
  displayName: string;
  locale: 'en' | 'vi';
}

export const DEV_USER_HEADER = 'x-dev-user';
/** Same as the header, for browsers (docs page, "try it"): `document.cookie = 'sit-dev-user=dev-estimator'`. */
export const DEV_USER_COOKIE = 'sit-dev-user';

/**
 * Who is calling (design 10.5: identity comes from the IdP, project roles from the app).
 *
 * 1. The app session cookie set after Keycloak sign-in (ADR-0004). The proxy refreshes it.
 * 2. AUTH_MODE=dev only: a seeded user named in the `x-dev-user` header or `sit-dev-user`
 *    cookie. env.ts allows dev mode only when APP_ENV=local.
 */
export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
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
    if (session) {
      const user = await loadUser({ id: session.uid });
      if (user && user.subject === session.sub) return user;
    }
  }
  if (env.AUTH_MODE === 'dev') {
    const subject = devHeader || cookies[DEV_USER_COOKIE];
    if (subject) return loadUser({ subject });
  }
  return null;
}

export function loadUserBySubject(subject: string): Promise<CurrentUser | null> {
  return loadUser({ subject });
}

async function loadUser(where: { id: string } | { subject: string }): Promise<CurrentUser | null> {
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
  };
}
