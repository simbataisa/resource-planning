import type {
  AdminUser,
  AuditEventItem,
  AuditQuery,
  UserListQuery,
  UserUpdate,
} from '@sit/schemas';
import type { z } from 'zod';
import type { CurrentUser } from '../auth/current-user';
import { db } from '../db';
import { auditWhere } from '../domain/audit';
import { userRef } from '../dto';
import { HttpError } from '../http/route';
import { recordAudit } from '../repositories/audit';
import { USER_REF } from '../repositories/includes';
import { ensure, notFound, type RequestMeta } from './access';

const pageOf = <T extends { id: string }>(rows: T[], limit: number) => {
  const more = rows.length > limit;
  const items = more ? rows.slice(0, limit) : rows;
  return { items, nextCursor: more ? (items.at(-1)?.id ?? null) : null };
};

/**
 * The audit log (design 10.6, release 3 H-01), newest first. With a project: QE Leads of
 * that project and Admins. Without one: Admins only (all projects and global events).
 */
export async function listAudit(user: CurrentUser, q: z.output<typeof AuditQuery>) {
  if (q.projectId) ensure(user, 'audit.read.project', q.projectId);
  else ensure(user, 'audit.read.all');
  const rows = await db().auditEvent.findMany({
    where: auditWhere(q),
    orderBy: [{ at: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: { actor: USER_REF, project: { select: { id: true, key: true, name: true } } },
  });
  const p = pageOf(rows, q.limit);
  return {
    nextCursor: p.nextCursor,
    items: p.items.map((e): AuditEventItem => ({
      id: e.id,
      at: e.at.toISOString(),
      actor: userRef(e.actor),
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      project: e.project,
      detail: (e.detail ?? {}) as Record<string, unknown>,
      requestId: e.requestId,
    })),
  };
}

const USER_INCLUDE = {
  memberships: {
    select: { projectId: true, role: true, project: { select: { key: true } } },
    orderBy: { addedAt: 'asc' as const },
  },
} as const;

type UserRow = Awaited<ReturnType<typeof findUser>>;
const findUser = (id: string) => db().user.findUnique({ where: { id }, include: USER_INCLUDE });

function adminUserDto(u: NonNullable<UserRow>): AdminUser {
  return {
    ...userRef(u),
    globalRole: u.globalRole,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    memberships: u.memberships.map((m) => ({
      projectId: m.projectId,
      projectKey: m.project.key,
      role: m.role,
    })),
  };
}

/** Everyone who has signed in at least once (Admin). */
export async function listUsers(user: CurrentUser, q: z.output<typeof UserListQuery>) {
  ensure(user, 'user.manage');
  const rows = await db().user.findMany({
    where: q.q
      ? {
          OR: [
            { displayName: { contains: q.q, mode: 'insensitive' } },
            { email: { contains: q.q, mode: 'insensitive' } },
          ],
        }
      : {},
    orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: USER_INCLUDE,
  });
  const p = pageOf(rows, q.limit);
  return { nextCursor: p.nextCursor, items: p.items.map(adminUserDto) };
}

/**
 * Deactivate or reactivate an app user (Admin). A deactivated user is refused on the next
 * request and at sign-in. The Admin role itself is managed in Keycloak, not here.
 */
export async function setUserActive(
  user: CurrentUser,
  id: string,
  input: z.output<typeof UserUpdate>,
  meta: RequestMeta,
) {
  ensure(user, 'user.manage');
  if (id === user.id && !input.active)
    throw new HttpError(409, 'CONFLICT', 'You cannot deactivate yourself.', [{ reason: 'SELF' }]);
  await db().$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id }, select: { active: true } });
    if (!u) throw notFound();
    if (u.active === input.active) return;
    await tx.user.update({ where: { id }, data: { active: input.active } });
    await recordAudit(tx, {
      actorId: user.id,
      action: input.active ? 'user.activate' : 'user.deactivate',
      entity: 'User',
      entityId: id,
      requestId: meta.requestId,
    });
  });
  return adminUserDto((await findUser(id))!);
}
