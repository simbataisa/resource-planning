import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as readAll from '@/app/api/v1/notifications/read-all/route';
import * as readOne from '@/app/api/v1/notifications/[notificationId]/read/route';
import * as list from '@/app/api/v1/notifications/route';
import * as versions from '@/app/api/v1/estimates/[estimateId]/versions/route';
import * as approve from '@/app/api/v1/estimates/[estimateId]/versions/[number]/approve/route';
import * as ret from '@/app/api/v1/estimates/[estimateId]/versions/[number]/return/route';
import * as submit from '@/app/api/v1/estimates/[estimateId]/versions/[number]/submit/route';
import * as profiles from '@/app/api/v1/profiles/route';
import * as publish from '@/app/api/v1/profiles/[profileId]/publish/route';
import * as estimates from '@/app/api/v1/projects/[projectId]/estimates/route';
import { db } from '@/server/db';
import { dispatchOnce, type OutgoingMail } from '@/server/notifications/dispatcher';
import { smtpSender } from '@/server/notifications/transport';
import { call, seeded, type Who } from './helpers';
import { configureContainerRuntime } from '../support/container-runtime';

/** N-01: outbox rows with the business change, the worker's delivery and retries, the in-app API. */
let projectId: string;
let estimateId: string;
const ids: Record<string, string> = {};
const run = Date.now().toString(36);

beforeAll(async () => {
  projectId = (await seeded()).demo.id;
  for (const s of ['dev-admin', 'dev-lead', 'dev-estimator', 'dev-viewer']) {
    ids[s] = (await db().user.findUniqueOrThrow({ where: { subject: s } })).id;
  }
  // Start from an empty queue so counts below only see this file's emails.
  await db().notification.updateMany({
    where: { channel: 'EMAIL', status: 'PENDING' },
    data: { status: 'SENT', nextAttemptAt: null },
  });
});

const act = (h: typeof submit.POST, who: Who, n: number, body: unknown = {}) =>
  call(h, { who, method: 'POST', params: { estimateId, number: String(n) }, body });
const inbox = (who: string) =>
  db().notification.findMany({
    where: { recipientId: ids[who], channel: 'IN_APP' },
    orderBy: { createdAt: 'asc' },
  });

describe('outbox', () => {
  it('notifies QE Leads in the same transaction as a submission', async () => {
    const est = await call(estimates.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { projectId },
      body: { name: `Synthetic · notify ${run}` },
    });
    estimateId = est.json.id;
    await call(versions.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { estimateId },
      body: {},
    });
    expect((await act(submit.POST, 'dev-estimator', 1, { note: 'Please review' })).status).toBe(
      200,
    );
    const rows = await db().notification.findMany({
      where: { version: { estimateId }, kind: 'SUBMITTED' },
    });
    expect(rows.map((r) => [r.recipientId, r.channel, r.status]).sort()).toEqual(
      [
        [ids['dev-lead'], 'EMAIL', 'PENDING'],
        [ids['dev-lead'], 'IN_APP', 'SENT'],
      ].sort(),
    );
    expect(rows[0]!.payload).toMatchObject({
      actorName: 'Synthetic Estimator',
      estimateName: `Synthetic · notify ${run}`,
      versionNumber: 1,
      note: 'Please review',
    });
  });

  it('notifies the author on return and approval, never the actor', async () => {
    await act(ret.POST, 'dev-lead', 1, { note: 'Add batch interfaces' });
    await act(submit.POST, 'dev-estimator', 1);
    await act(approve.POST, 'dev-lead', 1);
    const kinds = (await inbox('dev-estimator'))
      .filter((n) => (n.payload as { estimateId?: string }).estimateId === estimateId)
      .map((n) => n.kind);
    expect(kinds).toEqual(['RETURNED', 'APPROVED']);
    const leadKinds = (await inbox('dev-lead'))
      .filter((n) => (n.payload as { estimateId?: string }).estimateId === estimateId)
      .map((n) => n.kind);
    expect(leadKinds).toEqual(['SUBMITTED', 'SUBMITTED']);
  });

  it('notifies project Estimators and Leads when a project profile is published', async () => {
    const p = await call(profiles.POST, {
      who: 'dev-lead',
      method: 'POST',
      path: '/profiles',
      body: { name: `Synthetic · notify ${run}`, scope: 'PROJECT', projectId },
    });
    await call(publish.POST, { who: 'dev-lead', method: 'POST', params: { profileId: p.json.id } });
    const rows = await db().notification.findMany({
      where: { kind: 'PROFILE_PUBLISHED', channel: 'IN_APP' },
    });
    const mine = rows.filter((r) => (r.payload as { profileId?: string }).profileId === p.json.id);
    expect(mine.map((r) => r.recipientId)).toEqual([ids['dev-estimator']]);
  });
});

describe('worker delivery and retries', () => {
  const opts = (send: (m: OutgoingMail) => Promise<void>, now = new Date()) => ({
    db: db(),
    send,
    now: () => now,
    baseUrl: 'http://localhost:3000',
    maxAttempts: 3,
  });

  it('retries a failed email with backoff, then marks it FAILED at the limit', async () => {
    const failing = async () => {
      throw new Error('421 try later for lead@example.invalid');
    };
    let now = new Date();
    const first = await dispatchOnce(opts(failing, now));
    expect(first.retried).toBeGreaterThan(0);
    const row = await db().notification.findFirstOrThrow({
      where: { channel: 'EMAIL', status: 'PENDING', attempts: 1 },
    });
    expect(row.lastError).toBe('Error: 421 try later for <address>');
    expect(row.nextAttemptAt!.getTime() - now.getTime()).toBe(60_000);
    // Not due yet: nothing is sent.
    expect((await dispatchOnce(opts(failing, now))).retried).toBe(0);
    now = new Date(now.getTime() + 61_000);
    await dispatchOnce(opts(failing, now));
    now = new Date(now.getTime() + 3 * 60_000);
    const last = await dispatchOnce(opts(failing, now));
    expect(last.failed).toBeGreaterThan(0);
    const failed = await db().notification.findUniqueOrThrow({ where: { id: row.id } });
    expect(failed).toMatchObject({ status: 'FAILED', attempts: 3, nextAttemptAt: null });
  });

  it('delivers through SMTP to the mail catcher, in the recipient language', async () => {
    configureContainerRuntime();
    const mailpit: StartedTestContainer = await new GenericContainer(
      `${process.env.REGISTRY_PREFIX ?? ''}axllent/mailpit:v1.31.4`,
    )
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forHttp('/livez', 8025))
      .start();
    try {
      await db().user.update({ where: { id: ids['dev-lead']! }, data: { locale: 'vi' } });
      // Queue one fresh email: a new estimate, saved and submitted.
      const r = await call(estimates.POST, {
        who: 'dev-estimator',
        method: 'POST',
        params: { projectId },
        body: { name: `Synthetic · smtp ${run}` },
      });
      estimateId = r.json.id;
      await call(versions.POST, {
        who: 'dev-estimator',
        method: 'POST',
        params: { estimateId },
        body: {},
      });
      await act(submit.POST, 'dev-estimator', 1);
      const smtp = `smtp://${mailpit.getHost()}:${mailpit.getMappedPort(1025)}`;
      const d = await dispatchOnce(
        opts(smtpSender(smtp, 'SIT Sizing <no-reply@sit-sizing.local>')),
      );
      expect(d.sent).toBe(1);
      const api = `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}/api/v1/messages`;
      const box = (await (await fetch(api)).json()) as {
        messages: { Subject: string; To: { Address: string }[] }[];
      };
      expect(box.messages).toHaveLength(1);
      expect(box.messages[0]!.To[0]!.Address).toBe('lead@example.invalid');
      expect(box.messages[0]!.Subject).toBe(`Cần phê duyệt: Synthetic · smtp ${run} v1`);
      const sent = await db().notification.findFirstOrThrow({
        where: { channel: 'EMAIL', version: { estimateId } },
      });
      expect(sent).toMatchObject({ status: 'SENT', attempts: 1 });
      expect(sent.sentAt).not.toBeNull();
    } finally {
      await db().user.update({ where: { id: ids['dev-lead']! }, data: { locale: 'en' } });
      await mailpit.stop();
    }
  }, 120_000);

  it('never sends the same email twice when two workers run at once', async () => {
    await act(ret.POST, 'dev-lead', 1, { note: 'again' });
    const sent: string[] = [];
    const send = async (m: OutgoingMail) => {
      await new Promise((r) => setTimeout(r, 20));
      sent.push(m.to);
    };
    const [a, b] = await Promise.all([dispatchOnce(opts(send)), dispatchOnce(opts(send))]);
    expect(a.sent + b.sent).toBe(sent.length);
    expect(sent).toEqual(['estimator@example.invalid']);
  });
});

describe('GET/POST /notifications', () => {
  it('lists my notices with the unread count, and marks them read', async () => {
    const res = await call(list.GET, { who: 'dev-estimator', path: '/notifications' });
    expect(res.status).toBe(200);
    expect(res.json.unread).toBeGreaterThan(0);
    expect(res.json.items[0]).toMatchObject({ kind: 'RETURNED', readAt: null });
    const first = res.json.items[0].id;
    const after = await call(readOne.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { notificationId: first },
    });
    expect(after.json.unread).toBe(res.json.unread - 1);
    // Someone else's notice is not found.
    expect(
      (
        await call(readOne.POST, {
          who: 'dev-lead',
          method: 'POST',
          params: { notificationId: first },
        })
      ).status,
    ).toBe(404);
    const all = await call(readAll.POST, { who: 'dev-estimator', method: 'POST' });
    expect(all.json.unread).toBe(0);
    expect((await call(list.GET, { who: null, path: '/notifications' })).status).toBe(401);
  });
});

afterAll(async () => {
  await db().notification.updateMany({
    where: { channel: 'EMAIL', status: 'PENDING' },
    data: { status: 'SENT', nextAttemptAt: null },
  });
});
