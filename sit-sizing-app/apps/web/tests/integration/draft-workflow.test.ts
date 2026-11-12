import { compute, DEFAULT_ASSUMPTIONS } from '@sit/engine';
import type { EstimateInputs } from '@sit/schemas';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as draft from '@/app/api/v1/estimates/[estimateId]/draft/route';
import * as lock from '@/app/api/v1/estimates/[estimateId]/draft/lock/route';
import * as versions from '@/app/api/v1/estimates/[estimateId]/versions/route';
import * as estimates from '@/app/api/v1/projects/[projectId]/estimates/route';
import { clock } from '@/server/clock';
import { db } from '@/server/db';
import { LOCK_MINUTES } from '@/server/domain/lock';
import { call, seeded } from './helpers';

/** Draft lifecycle, edit lock (A-06) and optimistic locking, end to end through the handlers. */
let projectId: string;
let estimateId: string;
let rowVersion: number;

beforeAll(async () => {
  projectId = (await seeded()).demo.id;
});
afterEach(() => vi.restoreAllMocks());

const p = () => ({ estimateId });
const reason = (json: { error: { details?: { reason?: string }[] } }) =>
  json.error.details?.[0]?.reason;

describe('draft workflow', () => {
  it('creates an estimate with draft 1 locked to its creator', async () => {
    const res = await call(estimates.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { projectId },
      body: { name: 'Synthetic · workflow' },
    });
    expect(res.status).toBe(201);
    expect(res.json.hasDraft).toBe(true);
    expect(res.json.latest.status).toBe('DRAFT');
    estimateId = res.json.id;
    const v = await db().estimateVersion.findFirstOrThrow({ where: { estimateId } });
    expect(v.lockedById).not.toBeNull();
    rowVersion = v.rowVersion;
  });

  it('autosaves, recomputes on the server and bumps rowVersion', async () => {
    const v = await db().estimateVersion.findFirstOrThrow({ where: { estimateId } });
    const inputs = structuredClone(v.inputs) as unknown as EstimateInputs;
    inputs.team.weeks = 12;
    const res = await call(draft.PATCH, {
      who: 'dev-estimator',
      method: 'PATCH',
      params: p(),
      body: { rowVersion, inputs },
    });
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.rowVersion).toBe(rowVersion + 1);
    const expected = compute('detailed', inputs, structuredClone(DEFAULT_ASSUMPTIONS)).fte;
    expect(res.json.detailedFte).toBeCloseTo(expected, 2);
    expect(res.json.result.detailed.fte).toBeCloseTo(expected, 10);
    rowVersion = res.json.rowVersion;
  });

  it('rejects a stale rowVersion with 409 STALE', async () => {
    const res = await call(draft.PATCH, {
      who: 'dev-estimator',
      method: 'PATCH',
      params: p(),
      body: { rowVersion: rowVersion - 1, note: 'x' },
    });
    expect(res.status).toBe(409);
    expect(reason(res.json)).toBe('STALE');
  });

  it('refuses edits from someone without the lock, and from a viewer', async () => {
    const lead = await call(draft.PATCH, {
      who: 'dev-lead',
      method: 'PATCH',
      params: p(),
      body: { rowVersion, note: 'x' },
    });
    expect(lead.status).toBe(409);
    expect(reason(lead.json)).toBe('LOCK_REQUIRED');
    expect(
      (
        await call(draft.PATCH, {
          who: 'dev-viewer',
          method: 'PATCH',
          params: p(),
          body: { rowVersion, note: 'x' },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(draft.PATCH, {
          who: 'dev-outsider',
          method: 'PATCH',
          params: p(),
          body: { rowVersion, note: 'x' },
        })
      ).status,
    ).toBe(404);
  });

  it('lets only a QE Lead take over a valid lock, and audits it', async () => {
    const held = await call(lock.POST, { who: 'dev-lead', method: 'POST', params: p(), body: {} });
    expect(held.status).toBe(409);
    expect(reason(held.json)).toBe('HELD_BY_OTHER');
    const takeover = await call(lock.POST, {
      who: 'dev-lead',
      method: 'POST',
      params: p(),
      body: { takeover: true },
    });
    expect(takeover.status).toBe(200);
    expect(takeover.json.lock.mine).toBe(true);
    const audit = await db().auditEvent.findFirst({
      where: { action: 'estimate.draft.lock.takeover', entityId: takeover.json.id },
    });
    expect(audit).not.toBeNull();
    const est = await call(lock.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: p(),
      body: { takeover: true },
    });
    expect(est.status).toBe(403);
  });

  it('frees the lock after it expires', async () => {
    const later = new Date(Date.now() + (LOCK_MINUTES + 1) * 60_000);
    vi.spyOn(clock, 'now').mockReturnValue(later);
    const res = await call(lock.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: p(),
      body: {},
    });
    expect(res.status).toBe(200);
    expect(res.json.lock.mine).toBe(true);
    rowVersion = res.json.rowVersion;
  });

  it('saves the draft as an immutable version and audits it', async () => {
    vi.spyOn(clock, 'now').mockReturnValue(new Date(Date.now() + (LOCK_MINUTES + 2) * 60_000));
    const res = await call(versions.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: p(),
      body: { note: 'Synthetic · v1' },
    });
    expect(res.status, JSON.stringify(res.json)).toBe(201);
    expect(res.json.status).toBe('SAVED');
    expect(res.json.lock).toBeNull();
    const after = await call(draft.PATCH, {
      who: 'dev-estimator',
      method: 'PATCH',
      params: p(),
      body: { rowVersion: res.json.rowVersion, note: 'x' },
    });
    expect(reason(after.json)).toBe('NO_DRAFT');
    expect(
      await db().auditEvent.count({
        where: { action: 'estimate.version.save', entityId: res.json.id },
      }),
    ).toBe(1);
  });

  it('starts a new draft from the latest version', async () => {
    const res = await call(draft.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: p(),
      body: {},
    });
    expect(res.status).toBe(201);
    expect(res.json.number).toBe(2);
    expect(res.json.status).toBe('DRAFT');
    const again = await call(draft.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: p(),
      body: {},
    });
    expect(reason(again.json)).toBe('DRAFT_EXISTS');
  });

  it('releases the lock (holder only)', async () => {
    expect(
      (await call(lock.DELETE, { who: 'dev-lead', method: 'DELETE', params: p() })).status,
    ).toBe(409);
    expect(
      (await call(lock.DELETE, { who: 'dev-estimator', method: 'DELETE', params: p() })).status,
    ).toBe(204);
  });
});

describe('database guards', () => {
  it('allows only one draft per estimate', async () => {
    const d = await db().estimateVersion.findFirstOrThrow({
      where: { estimateId, status: 'DRAFT' },
    });
    const { id: _id, number: _n, ...rest } = d;
    await expect(
      db().estimateVersion.create({
        data: {
          ...rest,
          number: 99,
          inputs: d.inputs as object,
          assumptions: d.assumptions as object,
          result: d.result as object,
        },
      }),
    ).rejects.toThrow();
  });

  it('keeps the audit trail append-only', async () => {
    await expect(db().auditEvent.updateMany({ data: { action: 'tampered' } })).rejects.toThrow(
      /append-only/,
    );
    await expect(db().auditEvent.deleteMany({})).rejects.toThrow(/append-only/);
  });

  it('rejects a cross-site state change', async () => {
    const request = new Request('http://localhost:3000/api/v1/x', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
        host: 'localhost:3000',
        'x-dev-user': 'dev-estimator',
      },
      body: '{}',
    });
    const res = await draft.POST(request, { params: Promise.resolve({ estimateId }) });
    expect(res.status).toBe(403);
  });
});
