import type { GlobalRole } from '@/lib/rbac';
import { db } from '../db';
import { recordAudit } from '../repositories/audit';

/** Keycloak group that maps to the app's global Admin role (design 10.5). */
export const ADMIN_GROUP = 'sit-sizing-admins';

export interface IdClaims {
  sub: string;
  email?: unknown;
  name?: unknown;
  preferred_username?: unknown;
  locale?: unknown;
  groups?: unknown;
}

export function roleFromGroups(groups: unknown): GlobalRole {
  const list = Array.isArray(groups) ? groups.map((g) => String(g).replace(/^\//, '')) : [];
  return list.includes(ADMIN_GROUP) ? 'ADMIN' : 'USER';
}

/** Maps ID token claims to the app user fields. Only identity data; nothing else is stored. */
export function profileFromClaims(c: IdClaims) {
  const email =
    typeof c.email === 'string' && c.email ? c.email.toLowerCase() : `${c.sub}@users.invalid`;
  const displayName =
    (typeof c.name === 'string' && c.name.trim()) ||
    (typeof c.preferred_username === 'string' && c.preferred_username) ||
    email;
  const locale = c.locale === 'vi' ? 'vi' : 'en';
  return { email, displayName, locale, globalRole: roleFromGroups(c.groups) };
}

/**
 * Upserts the app user by OIDC subject on every sign-in (design 10.3). Never links by
 * e-mail. A global role change is audited. Returns null for a deactivated app user.
 */
export async function provisionUser(claims: IdClaims, requestId: string) {
  const p = profileFromClaims(claims);
  return db().$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { subject: claims.sub } });
    const user = await tx.user.upsert({
      where: { subject: claims.sub },
      create: { subject: claims.sub, ...p, lastLoginAt: new Date() },
      update: { ...p, lastLoginAt: new Date() },
    });
    if (before && before.globalRole !== user.globalRole) {
      await recordAudit(tx, {
        actorId: user.id,
        action: 'user.role.change',
        entity: 'User',
        entityId: user.id,
        detail: { from: before.globalRole, to: user.globalRole, source: 'idp-groups' },
        requestId,
      });
    }
    return user.active ? user : null;
  });
}
