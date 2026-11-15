import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as draft from '@/app/api/v1/estimates/[estimateId]/draft/route';
import * as lock from '@/app/api/v1/estimates/[estimateId]/draft/lock/route';
import * as applyRoute from '@/app/api/v1/estimates/[estimateId]/draft/profile/route';
import * as estimate from '@/app/api/v1/estimates/[estimateId]/route';
import * as oneVersion from '@/app/api/v1/estimates/[estimateId]/versions/[number]/route';
import * as versions from '@/app/api/v1/estimates/[estimateId]/versions/route';
import * as estimates from '@/app/api/v1/projects/[projectId]/estimates/route';
import { clock } from '@/server/clock';
import { db } from '@/server/db';
import { LOCK_MINUTES } from '@/server/domain/lock';
import { hashLockToken } from '@/server/domain/lock-token';
import { call, seeded } from './helpers';

/**
 * Draft lock token (draft lock token design, Task 1): only the tab or assistant session
 * that took the lock can renew, use or release it. Synthetic data only.
 */
let projectId: string;
let profileId: string;
const run = Date.now().toString(36);

beforeAll(async () => {
  const s = await seeded();
  projectId = s.demo.id;
  profileId = s.profile.id;
});
afterEach(() => vi.restoreAllMocks());

const reason = (json: { error: { details?: { reason?: string }[] } }) =>
  json.error.details?.[0]?.reason;

async function newEstimate(name: string) {
  const res = await call(estimates.POST, {
    who: 'dev-estimator',
    method: 'POST',
    params: { projectId },
    body: { name: `Synthetic · lock token ${run} ${name}` },
  });
  expect(res.status, JSON.stringify(res.json)).toBe(201);
  return { estimateId: res.json.id as string, token: res.json.lockToken as string };
}

const draftRow = (estimateId: string) =>
  db().estimateVersion.findFirstOrThrow({ where: { estimateId, status: 'DRAFT' } });

const lockCall = (estimateId: string, lockToken?: string, takeover = false) =>
  call(lock.POST, {
    who: 'dev-estimator',
    method: 'POST',
    params: { estimateId },
    body: { takeover },
    lockToken,
  });

describe('draft lock token', () => {
  it('creating an estimate returns a token; the database holds only its hash', async () => {
    const { estimateId, token } = await newEstimate('create');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await draftRow(estimateId);
    expect(row.lockTokenHash).toBe(hashLockToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it('taking a free lock returns a token and stores its hash', async () => {
    const { estimateId, token } = await newEstimate('free');
    const released = await call(lock.DELETE, {
      who: 'dev-estimator',
      method: 'DELETE',
      params: { estimateId },
      lockToken: token,
    });
    expect(released.status).toBe(204);
    expect((await draftRow(estimateId)).lockTokenHash).toBeNull();
    const res = await lockCall(estimateId);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.lockToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.json.lock.mine).toBe(true);
    expect((await draftRow(estimateId)).lockTokenHash).toBe(hashLockToken(res.json.lockToken));
  });

  it('renewal with the token keeps it; a lock call without it is LOCKED_ELSEWHERE', async () => {
    const { estimateId, token } = await newEstimate('renew');
    const renewed = await lockCall(estimateId, token);
    expect(renewed.status, JSON.stringify(renewed.json)).toBe(200);
    expect(renewed.json.lockToken).toBeUndefined();
    expect((await draftRow(estimateId)).lockTokenHash).toBe(hashLockToken(token));
    const other = await lockCall(estimateId);
    expect(other.status).toBe(409);
    expect(other.json.error.code).toBe('CONFLICT');
    expect(reason(other.json)).toBe('LOCKED_ELSEWHERE');
    expect(other.json.error.message).toBe('This draft is open in another tab or in the assistant.');
    expect((await lockCall(estimateId, 'not-the-token')).status).toBe(409);
  });

  it('own takeover issues a new token, refuses the old one and is audited as own', async () => {
    const { estimateId, token } = await newEstimate('own takeover');
    const taken = await lockCall(estimateId, undefined, true);
    expect(taken.status, JSON.stringify(taken.json)).toBe(200);
    const fresh = taken.json.lockToken as string;
    expect(fresh).toBeTruthy();
    expect(fresh).not.toBe(token);
    const old = await call(draft.PATCH, {
      who: 'dev-estimator',
      method: 'PATCH',
      params: { estimateId },
      body: { rowVersion: taken.json.rowVersion, note: 'Synthetic · old tab' },
      lockToken: token,
    });
    expect(old.status).toBe(409);
    expect(reason(old.json)).toBe('LOCKED_ELSEWHERE');
    const audit = await db().auditEvent.findFirstOrThrow({
      where: { action: 'estimate.draft.lock.takeover', entityId: taken.json.id },
    });
    expect(audit.detail).toMatchObject({ own: true });
  });

  it('PATCH, apply profile, save version and release refuse a missing or wrong token and write nothing', async () => {
    const { estimateId, token } = await newEstimate('refusals');
    const before = await draftRow(estimateId);
    for (const lockToken of [undefined, 'not-the-token']) {
      const patch = await call(draft.PATCH, {
        who: 'dev-estimator',
        method: 'PATCH',
        params: { estimateId },
        body: { rowVersion: before.rowVersion, note: 'Synthetic · second tab' },
        lockToken,
      });
      const apply = await call(applyRoute.POST, {
        who: 'dev-estimator',
        method: 'POST',
        params: { estimateId },
        body: { profileId, rowVersion: before.rowVersion },
        lockToken,
      });
      const save = await call(versions.POST, {
        who: 'dev-estimator',
        method: 'POST',
        params: { estimateId },
        body: { note: 'Synthetic · second tab' },
        lockToken,
      });
      const release = await call(lock.DELETE, {
        who: 'dev-estimator',
        method: 'DELETE',
        params: { estimateId },
        lockToken,
      });
      for (const res of [patch, apply, save, release]) {
        expect(res.status, JSON.stringify(res.json)).toBe(409);
        expect(reason(res.json)).toBe('LOCKED_ELSEWHERE');
      }
    }
    // Nothing written, and the wrong-token release left the lock and hash in place.
    const after = await draftRow(estimateId);
    expect(after.status).toBe('DRAFT');
    expect(after.rowVersion).toBe(before.rowVersion);
    expect(after.note).toBe(before.note);
    expect(after.lockedById).toBe(before.lockedById);
    expect(after.lockExpiresAt).toEqual(before.lockExpiresAt);
    expect(after.lockTokenHash).toBe(hashLockToken(token));
    expect(
      await db().auditEvent.count({
        where: {
          entityId: before.id,
          action: { in: ['estimate.version.save', 'estimate.draft.profile.apply'] },
        },
      }),
    ).toBe(0);
  });

  it('the right token writes, saves and clears the hash with the lock', async () => {
    const { estimateId, token } = await newEstimate('happy path');
    const row = await draftRow(estimateId);
    const patch = await call(draft.PATCH, {
      who: 'dev-estimator',
      method: 'PATCH',
      params: { estimateId },
      body: { rowVersion: row.rowVersion, note: 'Synthetic · first tab' },
      lockToken: token,
    });
    expect(patch.status, JSON.stringify(patch.json)).toBe(200);
    expect(patch.json.lockToken).toBeUndefined();
    const apply = await call(applyRoute.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { estimateId },
      body: { profileId, rowVersion: patch.json.rowVersion },
      lockToken: token,
    });
    expect(apply.status, JSON.stringify(apply.json)).toBe(200);
    const save = await call(versions.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { estimateId },
      body: { note: 'Synthetic · v1' },
      lockToken: token,
    });
    expect(save.status, JSON.stringify(save.json)).toBe(201);
    const saved = await db().estimateVersion.findUniqueOrThrow({ where: { id: row.id } });
    expect(saved.lockedById).toBeNull();
    expect(saved.lockTokenHash).toBeNull();
  });

  it('an expired lock with a stale token is taken afresh; the stale token stops working', async () => {
    const { estimateId, token } = await newEstimate('expired');
    vi.spyOn(clock, 'now').mockReturnValue(new Date(Date.now() + (LOCK_MINUTES + 1) * 60_000));
    const res = await lockCall(estimateId, token);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    const fresh = res.json.lockToken as string;
    expect(fresh).toBeTruthy();
    expect(fresh).not.toBe(token);
    const stale = await lockCall(estimateId, token);
    expect(stale.status).toBe(409);
    expect(reason(stale.json)).toBe('LOCKED_ELSEWHERE');
    expect((await lockCall(estimateId, fresh)).status).toBe(200);
  });

  it('two tabs racing for a free lock: one wins, and only its token works', async () => {
    const { estimateId, token } = await newEstimate('race');
    await call(lock.DELETE, {
      who: 'dev-estimator',
      method: 'DELETE',
      params: { estimateId },
      lockToken: token,
    });
    const [a, b] = await Promise.all([lockCall(estimateId), lockCall(estimateId)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const winner = a.status === 200 ? a : b;
    const loser = a.status === 200 ? b : a;
    expect(loser.json.lockToken).toBeUndefined();
    const won = winner.json.lockToken as string;
    expect((await draftRow(estimateId)).lockTokenHash).toBe(hashLockToken(won));
    expect((await lockCall(estimateId, won)).status).toBe(200);
  });

  it("after a QE Lead takes over, the previous holder's token is refused", async () => {
    const { estimateId, token } = await newEstimate('lead takeover');
    const taken = await call(lock.POST, {
      who: 'dev-lead',
      method: 'POST',
      params: { estimateId },
      body: { takeover: true },
    });
    expect(taken.status, JSON.stringify(taken.json)).toBe(200);
    const leadToken = taken.json.lockToken as string;
    expect(leadToken).toBeTruthy();
    expect(leadToken).not.toBe(token);
    expect((await draftRow(estimateId)).lockTokenHash).toBe(hashLockToken(leadToken));

    const patched = await call(draft.PATCH, {
      who: 'dev-estimator',
      method: 'PATCH',
      params: { estimateId },
      body: { rowVersion: taken.json.rowVersion, note: 'Synthetic · previous holder' },
      lockToken: token,
    });
    expect(patched.status).toBe(409);
    const renewed = await lockCall(estimateId, token);
    expect(renewed.status).toBe(409);
    const released = await call(lock.DELETE, {
      who: 'dev-estimator',
      method: 'DELETE',
      params: { estimateId },
      lockToken: token,
    });
    expect(released.status).toBe(409);
    const row = await draftRow(estimateId);
    expect(row.note).not.toBe('Synthetic · previous holder');
    expect(row.lockTokenHash).toBe(hashLockToken(leadToken));
  });

  it('an over-long X-Lock-Token header is 400 VALIDATION_FAILED', async () => {
    const { estimateId } = await newEstimate('long header');
    const res = await lockCall(estimateId, 'a'.repeat(201));
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('VALIDATION_FAILED');
  });

  it('the previous app version clears the lock without the hash; the database clears the hash', async () => {
    // Rollback / rolling deploy: the old code path only knows lockedById and lockExpiresAt.
    const { estimateId } = await newEstimate('old path');
    const row = await draftRow(estimateId);
    expect(row.lockTokenHash).not.toBeNull();
    await db().estimateVersion.update({
      where: { id: row.id },
      data: { lockedById: null, lockExpiresAt: null },
    });
    const after = await draftRow(estimateId);
    expect(after.lockedById).toBeNull();
    expect(after.lockTokenHash).toBeNull();
  });

  it('the database never stores a token hash without a lock holder', async () => {
    const { estimateId } = await newEstimate('no holder');
    const row = await draftRow(estimateId);
    await db().estimateVersion.update({
      where: { id: row.id },
      data: { lockedById: null, lockExpiresAt: null, lockTokenHash: 'f'.repeat(64) },
    });
    expect((await draftRow(estimateId)).lockTokenHash).toBeNull();
  });

  it('deleting a user who holds a hashed lock succeeds and clears the hash', async () => {
    const { estimateId } = await newEstimate('user delete');
    const user = await db().user.create({
      data: {
        subject: `synthetic-lock-holder-${run}`,
        email: `synthetic.lock.holder.${run}@example.test`,
        displayName: 'Synthetic Lock Holder',
      },
    });
    const row = await draftRow(estimateId);
    await db().estimateVersion.update({
      where: { id: row.id },
      data: {
        lockedById: user.id,
        lockExpiresAt: new Date(clock.now().getTime() + LOCK_MINUTES * 60_000),
        lockTokenHash: hashLockToken('synthetic-token'),
      },
    });
    await db().user.delete({ where: { id: user.id } });
    const after = await draftRow(estimateId);
    expect(after.lockedById).toBeNull();
    expect(after.lockTokenHash).toBeNull();
  });

  it('createDraft returns a token; reads never do', async () => {
    const { estimateId, token } = await newEstimate('reads');
    const save = await call(versions.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { estimateId },
      body: {},
      lockToken: token,
    });
    expect(save.status, JSON.stringify(save.json)).toBe(201);
    const created = await call(draft.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { estimateId },
      body: {},
    });
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    const t = created.json.lockToken as string;
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await draftRow(estimateId)).lockTokenHash).toBe(hashLockToken(t));
    for (const who of ['dev-estimator', 'dev-lead'] as const) {
      const v = await call(oneVersion.GET, {
        who,
        params: { estimateId, number: String(created.json.number) },
      });
      expect(v.status).toBe(200);
      expect(v.json).not.toHaveProperty('lockToken');
      const e = await call(estimate.GET, { who, params: { estimateId } });
      expect(e.status).toBe(200);
      expect(e.json).not.toHaveProperty('lockToken');
      expect(JSON.stringify([v.json, e.json])).not.toContain(t);
    }
  });
});
