import { beforeAll, describe, expect, it } from 'vitest';
import * as compare from '@/app/api/v1/estimates/[estimateId]/compare/route';
import * as draft from '@/app/api/v1/estimates/[estimateId]/draft/route';
import * as versions from '@/app/api/v1/estimates/[estimateId]/versions/route';
import * as approve from '@/app/api/v1/estimates/[estimateId]/versions/[number]/approve/route';
import * as ret from '@/app/api/v1/estimates/[estimateId]/versions/[number]/return/route';
import * as submit from '@/app/api/v1/estimates/[estimateId]/versions/[number]/submit/route';
import * as estimates from '@/app/api/v1/projects/[projectId]/estimates/route';
import { db } from '@/server/db';
import { call, seeded, type Who } from './helpers';

/** Approval workflow and version compare (release 2, V-01), through the route handlers. */
let projectId: string;
let estimateId: string;

beforeAll(async () => {
  projectId = (await seeded()).demo.id;
});

const reason = (json: { error: { details?: { reason?: string }[] } }) =>
  json.error.details?.[0]?.reason;
type Handler = typeof submit.POST;
const act = (handler: Handler, who: Who, number: number, body: unknown = {}) =>
  call(handler, {
    who,
    method: 'POST',
    params: { estimateId, number: String(number) },
    body,
  });

describe('approval workflow', () => {
  it('sets up a saved v1 (synthetic data)', async () => {
    const res = await call(estimates.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { projectId },
      body: { name: 'Synthetic · review' },
    });
    expect(res.status).toBe(201);
    estimateId = res.json.id;
    const saved = await call(versions.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { estimateId },
      body: { note: 'Synthetic · v1' },
      lockToken: res.json.lockToken,
    });
    expect(saved.status, JSON.stringify(saved.json)).toBe(201);
  });

  it('refuses to approve a version that is not submitted', async () => {
    const res = await act(approve.POST, 'dev-lead', 1);
    expect(res.status).toBe(409);
    expect(reason(res.json)).toBe('WRONG_STATUS');
  });

  it('lets an Estimator submit, but not a Viewer', async () => {
    expect((await act(submit.POST, 'dev-viewer', 1)).status).toBe(403);
    const res = await act(submit.POST, 'dev-estimator', 1, { note: 'Ready for review' });
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.status).toBe('SUBMITTED');
    expect(res.json.submittedBy.displayName).toBeTruthy();
    expect(res.json.submittedAt).not.toBeNull();
    expect(res.json.reviews.map((r: { kind: string }) => r.kind)).toEqual(['COMMENT']);
    expect((await act(submit.POST, 'dev-estimator', 1)).status).toBe(409);
  });

  it('only lets a QE Lead approve or return', async () => {
    expect((await act(approve.POST, 'dev-estimator', 1)).status).toBe(403);
    expect((await act(ret.POST, 'dev-estimator', 1, { note: 'x' })).status).toBe(403);
  });

  it('requires a note to return, then puts the version back to SAVED', async () => {
    expect((await act(ret.POST, 'dev-lead', 1, {})).status).toBe(400);
    const res = await act(ret.POST, 'dev-lead', 1, { note: 'Check the API counts' });
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.status).toBe('SAVED');
    expect(res.json.submittedBy).toBeNull();
    expect(res.json.reviews.at(-1)).toMatchObject({ kind: 'RETURN', body: 'Check the API counts' });
  });

  it('blocks the submitter from approving (segregation of duties)', async () => {
    expect((await act(submit.POST, 'dev-lead', 1)).status).toBe(200);
    const res = await act(approve.POST, 'dev-lead', 1);
    expect(res.status).toBe(403);
    expect(reason(res.json)).toBe('SEGREGATION_OF_DUTIES');
  });

  it('lets another approver approve, and audits each step', async () => {
    const res = await act(approve.POST, 'dev-admin', 1, { note: 'Approved' });
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.status).toBe('APPROVED');
    expect(res.json.approvedBy).not.toBeNull();
    const v = await db().estimateVersion.findFirstOrThrow({ where: { estimateId, number: 1 } });
    const actions = (
      await db().auditEvent.findMany({ where: { entityId: v.id }, orderBy: { at: 'asc' } })
    ).map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'estimate.version.submit',
        'estimate.version.return',
        'estimate.version.approve',
      ]),
    );
  });

  it('supersedes the previous approval when a newer version is approved', async () => {
    const started = await call(draft.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { estimateId },
      body: {},
    });
    expect(started.status).toBe(201);
    expect(
      (
        await call(versions.POST, {
          who: 'dev-estimator',
          method: 'POST',
          params: { estimateId },
          body: { note: 'Synthetic · v2' },
          lockToken: started.json.lockToken,
        })
      ).status,
    ).toBe(201);
    expect((await act(submit.POST, 'dev-estimator', 2)).status).toBe(200);
    expect((await act(approve.POST, 'dev-lead', 2)).status).toBe(200);
    const v1 = await db().estimateVersion.findFirstOrThrow({ where: { estimateId, number: 1 } });
    expect(v1.status).toBe('SUPERSEDED');
  });
});

describe('version compare', () => {
  it('compares two versions and lists no changes for identical inputs', async () => {
    const res = await call(compare.GET, {
      who: 'dev-viewer',
      path: `/estimates/${estimateId}/compare?a=1&b=2`,
      params: { estimateId },
    });
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.changes).toEqual([]);
    expect(res.json.results.detailed.a.fte).toBeCloseTo(res.json.results.detailed.b.fte, 10);
    expect(Array.isArray(res.json.groups)).toBe(true);
  });

  it('returns 404 for a version that does not exist, and to non-members', async () => {
    const missing = await call(compare.GET, {
      who: 'dev-viewer',
      path: `/estimates/${estimateId}/compare?a=1&b=99`,
      params: { estimateId },
    });
    expect(missing.status).toBe(404);
    const outsider = await call(compare.GET, {
      who: 'dev-outsider',
      path: `/estimates/${estimateId}/compare?a=1&b=2`,
      params: { estimateId },
    });
    expect(outsider.status).toBe(404);
  });
});
