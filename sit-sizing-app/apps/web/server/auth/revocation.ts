import { db } from '../db';
import { ABSOLUTE_SECONDS } from './session';

/**
 * Revoked Keycloak sessions (back-channel logout, design 10.4). A row lives as long as the
 * longest app session could, then it is no longer needed and is removed.
 */
export async function revokeSession(sid: string, now: Date = new Date()): Promise<void> {
  const expiresAt = new Date(now.getTime() + ABSOLUTE_SECONDS * 1000);
  await db().revokedSession.upsert({
    where: { sid },
    create: { sid, expiresAt },
    update: { expiresAt },
  });
  await db().revokedSession.deleteMany({ where: { expiresAt: { lt: now } } });
}

export async function isSessionRevoked(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  return (await db().revokedSession.findUnique({ where: { sid }, select: { sid: true } })) !== null;
}
