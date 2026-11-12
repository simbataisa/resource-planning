import type { Prisma } from '@sit/db';
import type { NotificationPayload } from '@sit/schemas';
import type { Tx } from '../db';
import { recipients, type Audience, type Person } from '../domain/notifications';

/**
 * The notification outbox (design 5.2: rows written in the same transaction as the business
 * change). Each recipient gets an in-app notice, shown at once, and an email that the worker
 * sends with retries (server/notifications/dispatcher.ts).
 */
export async function enqueue(
  tx: Tx,
  e: {
    audience: Audience;
    projectId: string | null;
    versionId?: string;
    payload: NotificationPayload;
    now: Date;
  },
): Promise<string[]> {
  const people = await peopleFor(tx, e.projectId, e.audience);
  const ids = recipients(e.audience, people);
  if (!ids.length) return ids;
  const base = {
    kind: e.audience.kind,
    versionId: e.versionId ?? null,
    payload: e.payload as unknown as Prisma.InputJsonValue,
    createdAt: e.now,
  };
  await tx.notification.createMany({
    data: ids.flatMap((recipientId) => [
      { ...base, recipientId, channel: 'IN_APP' as const, status: 'SENT' as const, sentAt: e.now },
      {
        ...base,
        recipientId,
        channel: 'EMAIL' as const,
        status: 'PENDING' as const,
        nextAttemptAt: e.now,
      },
    ]),
  });
  return ids;
}

/** The people an event could concern, with their role in the project. */
async function peopleFor(tx: Tx, projectId: string | null, a: Audience): Promise<Person[]> {
  if (a.kind === 'PROFILE_PUBLISHED' && a.scope === 'GLOBAL') {
    const users = await tx.user.findMany({
      where: {
        OR: [{ globalRole: 'ADMIN' }, { memberships: { some: { role: 'QE_LEAD' } } }],
      },
      select: {
        id: true,
        active: true,
        globalRole: true,
        memberships: { where: { role: 'QE_LEAD' }, select: { projectId: true }, take: 1 },
      },
    });
    return users.map((u) => ({
      id: u.id,
      active: u.active,
      globalRole: u.globalRole,
      leadsAnyProject: u.memberships.length > 0,
    }));
  }
  const users = await tx.user.findMany({
    where: {
      OR: [
        ...(projectId ? [{ memberships: { some: { projectId } } }] : []),
        { globalRole: 'ADMIN' as const },
      ],
    },
    select: {
      id: true,
      active: true,
      globalRole: true,
      memberships: projectId ? { where: { projectId }, select: { role: true } } : false,
    },
  });
  return users.map((u) => ({
    id: u.id,
    active: u.active,
    globalRole: u.globalRole,
    projectRole:
      (u.memberships as { role: Person['projectRole'] }[] | undefined)?.[0]?.role ?? null,
  }));
}
