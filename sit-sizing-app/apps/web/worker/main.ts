/**
 * Notification worker (design 12.1 `worker` service, N-01). Same code base as the web app,
 * run as its own process: `pnpm --filter @sit/web worker`. Sends due emails from the outbox
 * every NOTIFY_POLL_MS. Several workers can run at once (rows are claimed with SKIP LOCKED).
 * Stops cleanly on SIGTERM/SIGINT after the current batch.
 */
// Before anything reads the configuration: this process serves no requests.
process.env.PROCESS_ROLE = 'worker';

import { clock } from '../server/clock';
import { db } from '../server/db';
import { getEnv } from '../server/env';
import { logger } from '../server/logger';
import { dispatchOnce } from '../server/notifications/dispatcher';
import { smtpSender } from '../server/notifications/transport';

const env = getEnv();
const log = logger.child({ component: 'notify-worker' });
let stopping = false;
let wake: (() => void) | null = null;

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    log.info({ signal }, 'stopping after the current batch');
    stopping = true;
    wake?.();
  });
}

async function main() {
  if (!env.SMTP_URL) {
    log.warn('SMTP_URL is not set: emails stay queued until it is (in-app notices still work)');
  }
  const send = env.SMTP_URL ? smtpSender(env.SMTP_URL, env.MAIL_FROM) : null;
  log.info({ pollMs: env.NOTIFY_POLL_MS, maxAttempts: env.NOTIFY_MAX_ATTEMPTS }, 'started');
  while (!stopping) {
    if (send) {
      try {
        const r = await dispatchOnce({
          db: db(),
          send,
          now: () => clock.now(),
          baseUrl: env.APP_BASE_URL,
          maxAttempts: env.NOTIFY_MAX_ATTEMPTS,
        });
        if (r.sent || r.retried || r.failed) log.info(r, 'batch done');
        // More may be due: go again at once when the batch was full.
        if (r.sent + r.retried + r.failed >= 20) continue;
      } catch (err) {
        log.error({ err }, 'batch failed; will retry');
      }
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, env.NOTIFY_POLL_MS);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
  await db().$disconnect();
  log.info('stopped');
}

main().catch((err: unknown) => {
  log.fatal({ err }, 'worker crashed');
  process.exit(1);
});
