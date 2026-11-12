import type { Principal, ProjectRole } from '@/lib/rbac';
import { db } from '../db';
import { getEnv } from '../env';

export interface CurrentUser extends Principal {
  subject: string;
  email: string;
  displayName: string;
  locale: 'en' | 'vi';
}

export const DEV_USER_HEADER = 'x-dev-user';
/** Same as the header, for browsers (docs page, "try it"): `document.cookie = 'sit-dev-user=dev-estimator'`. */
export const DEV_USER_COOKIE = 'sit-dev-user';

function devSubject(request: Request): string | null {
  const header = request.headers.get(DEV_USER_HEADER);
  if (header) return header;
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${DEV_USER_COOKIE}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Who is calling (design 10.5: identity comes from the IdP, project roles from the app).
 *
 * - AUTH_MODE=oidc: the Auth.js session (wired in step 1.3, A-03). Until then nobody is signed in.
 * - AUTH_MODE=dev:  the seeded user named in the `x-dev-user` header (or `sit-dev-user` cookie). env.ts allows
 *   this only when APP_ENV=local, so it can never be enabled in dev, sit or prod.
 */
export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  const env = getEnv();
  if (env.AUTH_MODE !== 'dev') return null; // step 1.3 replaces this with the Auth.js session
  const subject = devSubject(request);
  if (!subject) return null;
  return loadUserBySubject(subject);
}

export async function loadUserBySubject(subject: string): Promise<CurrentUser | null> {
  const user = await db().user.findUnique({
    where: { subject },
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
