import { NotificationPayload } from '@sit/schemas';
import type { PrismaClient } from '@sit/db';
import { afterAttempt, errorSummary, type NotificationKind } from '../domain/notifications';
import { renderEmail } from './email';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}
export type SendMail = (mail: OutgoingMail) => Promise<void>;

export interface DispatchOptions {
  db: PrismaClient;
  send: SendMail;
  now: () => Date;
  baseUrl: string;
  maxAttempts: number;
  /** Emails claimed per run. */
  batchSize?: number;
  /** How long a claimed email is hidden from other workers while it is being sent. */
  leaseMinutes?: number;
}

export interface DispatchResult {
  sent: number;
  retried: number;
  failed: number;
}

/**
 * Sends due emails from the outbox once (N-01). Safe with several workers: rows are claimed
 * with FOR UPDATE SKIP LOCKED and leased by moving nextAttemptAt forward, so a crashed
 * worker's rows come back after the lease. Each row is then sent and updated on its own.
 */
export async function dispatchOnce(o: DispatchOptions): Promise<DispatchResult> {
  const now = o.now();
  const lease = new Date(now.getTime() + (o.leaseMinutes ?? 5) * 60_000);
  const claimed = await o.db.$queryRaw<{ id: string }[]>`
    UPDATE "Notification" SET "nextAttemptAt" = ${lease}
    WHERE "id" IN (
      SELECT "id" FROM "Notification"
      WHERE "channel" = 'EMAIL' AND "status" = 'PENDING' AND "nextAttemptAt" <= ${now}
      ORDER BY "nextAttemptAt", "createdAt"
      LIMIT ${o.batchSize ?? 20}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"`;
  const result: DispatchResult = { sent: 0, retried: 0, failed: 0 };
  for (const { id } of claimed) {
    const n = await o.db.notification.findUniqueOrThrow({
      where: { id },
      include: { recipient: { select: { email: true, locale: true, active: true } } },
    });
    let ok = false;
    let error: unknown = null;
    if (!n.recipient.active) {
      error = new Error('Recipient is inactive.');
    } else {
      try {
        const mail = renderEmail(
          n.kind as NotificationKind,
          NotificationPayload.parse(n.payload),
          n.recipient.locale,
          o.baseUrl,
        );
        await o.send({ to: n.recipient.email, ...mail });
        ok = true;
      } catch (err) {
        error = err;
      }
    }
    // An inactive recipient will not become reachable by retrying.
    const outcome = afterAttempt(ok, n.attempts, n.recipient.active ? o.maxAttempts : 0);
    const at = o.now();
    if (outcome.status === 'SENT') {
      await o.db.notification.update({
        where: { id },
        data: { status: 'SENT', sentAt: at, attempts: n.attempts + 1, nextAttemptAt: null },
      });
      result.sent++;
    } else if (outcome.status === 'PENDING') {
      await o.db.notification.update({
        where: { id },
        data: {
          attempts: outcome.attempts,
          lastError: errorSummary(error),
          nextAttemptAt: new Date(at.getTime() + outcome.retryInMinutes * 60_000),
        },
      });
      result.retried++;
    } else {
      await o.db.notification.update({
        where: { id },
        data: {
          status: 'FAILED',
          attempts: outcome.attempts,
          lastError: errorSummary(error),
          nextAttemptAt: null,
        },
      });
      result.failed++;
    }
  }
  return result;
}
