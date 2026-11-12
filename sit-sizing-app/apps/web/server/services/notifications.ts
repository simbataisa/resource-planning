import { NotificationPayload, type NotificationItem } from '@sit/schemas';
import type { CurrentUser } from '../auth/current-user';
import { clock } from '../clock';
import { db } from '../db';
import { notFound } from './access';

const LIST_SIZE = 30;

/** The caller's in-app notices, newest first, with the unread count (N-01). */
export async function listNotifications(user: CurrentUser) {
  const where = { recipientId: user.id, channel: 'IN_APP' as const };
  const [rows, unread] = await Promise.all([
    db().notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: LIST_SIZE }),
    db().notification.count({ where: { ...where, readAt: null } }),
  ]);
  const items: NotificationItem[] = rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    payload: NotificationPayload.parse(n.payload),
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt ? n.readAt.toISOString() : null,
  }));
  return { items, unread };
}

/** Marks one of the caller's notices read. Someone else's notice is a 404. */
export async function markRead(user: CurrentUser, id: string) {
  const updated = await db().notification.updateMany({
    where: { id, recipientId: user.id, channel: 'IN_APP' },
    data: { readAt: clock.now() },
  });
  if (updated.count === 0) throw notFound();
  return listNotifications(user);
}

export async function markAllRead(user: CurrentUser) {
  await db().notification.updateMany({
    where: { recipientId: user.id, channel: 'IN_APP', readAt: null },
    data: { readAt: clock.now() },
  });
  return listNotifications(user);
}
