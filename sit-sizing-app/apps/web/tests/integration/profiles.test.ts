import { DEFAULT_ASSUMPTIONS } from '@sit/engine';
import type { Assumptions } from '@sit/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import * as applyRoute from '@/app/api/v1/estimates/[estimateId]/draft/profile/route';
import * as one from '@/app/api/v1/profiles/[profileId]/route';
import * as publish from '@/app/api/v1/profiles/[profileId]/publish/route';
import * as retire from '@/app/api/v1/profiles/[profileId]/retire/route';
import * as list from '@/app/api/v1/profiles/route';
import * as estimates from '@/app/api/v1/projects/[projectId]/estimates/route';
import { db } from '@/server/db';
import { call, seeded, type Who } from './helpers';

/** Assumption profiles (release 2, P-01) through the route handlers. Synthetic data only. */
let projectId: string;
let globalId: string;
let profileId: string;
const run = Date.now().toString(36);
const NAME = `Synthetic · profile ${run}`;

beforeAll(async () => {
  const s = await seeded();
  projectId = s.demo.id;
  globalId = s.profile.id;
});

const reason = (json: { error: { details?: { reason?: string }[] } }) =>
  json.error.details?.[0]?.reason;
const create = (who: Who, body: unknown) =>
  call(list.POST, { who, method: 'POST', path: '/profiles', body });
const patch = (who: Who, body: unknown) =>
  call(one.PATCH, { who, method: 'PATCH', params: { profileId }, body });
const status = (handler: typeof publish.POST, who: Who, id = profileId) =>
  call(handler, { who, method: 'POST', params: { profileId: id } });

async function newEstimate(name: string, profile?: string) {
  const res = await call(estimates.POST, {
    who: 'dev-estimator',
    method: 'POST',
    params: { projectId },
    body: { name, ...(profile ? { profileId: profile } : {}) },
  });
  return res;
}

describe('assumption profiles', () => {
  it('lets a QE Lead create a project profile, and refuses the wrong roles', async () => {
    const res = await create('dev-lead', { name: NAME, scope: 'PROJECT', projectId });
    expect(res.status, JSON.stringify(res.json)).toBe(201);
    expect(res.json).toMatchObject({ status: 'DRAFT', scope: 'PROJECT', uncalibrated: 160 });
    profileId = res.json.id;
    expect(
      (await create('dev-estimator', { name: `${NAME} x`, scope: 'PROJECT', projectId })).status,
    ).toBe(403);
    expect(
      (await create('dev-outsider', { name: `${NAME} x`, scope: 'PROJECT', projectId })).status,
    ).toBe(404);
    expect((await create('dev-lead', { name: `${NAME} g`, scope: 'GLOBAL' })).status).toBe(403);
    expect((await create('dev-lead', { name: `${NAME} g`, scope: 'PROJECT' })).status).toBe(400);
  });

  it('refuses a duplicate name in the same scope', async () => {
    const res = await create('dev-lead', { name: NAME, scope: 'PROJECT', projectId });
    expect(res.status).toBe(409);
    expect(reason(res.json)).toBe('NAME_TAKEN');
  });

  it('clones a global profile and lets an Admin create a global draft', async () => {
    const res = await create('dev-lead', {
      name: `${NAME} clone`,
      scope: 'PROJECT',
      projectId,
      basedOnId: globalId,
    });
    expect(res.status).toBe(201);
    expect(res.json.basedOnId).toBe(globalId);
    const g = await create('dev-admin', { name: `${NAME} global`, scope: 'GLOBAL' });
    expect(g.status).toBe(201);
    expect(g.json.projectId).toBeNull();
  });

  it('edits a draft: values and calibration notes for real rows only', async () => {
    const values = structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
    values.cases.api = values.cases.api.map((n) => n + 1) as typeof values.cases.api;
    const bad = await patch('dev-lead', { calibration: { 'not.a.row': { source: 'x' } } });
    expect(bad.status).toBe(422);
    const res = await patch('dev-lead', {
      values,
      calibration: { 'cases.api': { source: 'Synthetic · SIT cycle', measuredAt: '2026-10-01' } },
    });
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.uncalibrated).toBe(141);
    expect(res.json.calibration['cases.api'].source).toBe('Synthetic · SIT cycle');
    expect((await patch('dev-viewer', { name: 'x' })).status).toBe(403);
  });

  it('does not let a new estimate use a draft profile', async () => {
    const res = await newEstimate(`Synthetic · draft profile ${run}`, profileId);
    expect(res.status).toBe(422);
  });

  it('publishes, then freezes the profile', async () => {
    const res = await status(publish.POST, 'dev-lead');
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('PUBLISHED');
    expect(res.json.publishedAt).not.toBeNull();
    const again = await patch('dev-lead', { name: 'changed' });
    expect(again.status).toBe(409);
    expect(reason(again.json)).toBe('NOT_DRAFT');
    const audit = await db().auditEvent.findMany({ where: { entityId: profileId } });
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(['profile.create', 'profile.update', 'profile.publish']),
    );
  });

  it('starts a new estimate from the published profile (release 2 exit criterion)', async () => {
    const res = await newEstimate(`Synthetic · from profile ${run}`, profileId);
    expect(res.status, JSON.stringify(res.json)).toBe(201);
    const v = await db().estimateVersion.findFirstOrThrow({ where: { estimateId: res.json.id } });
    expect(v.profileId).toBe(profileId);
    expect(v.uncalibrated).toBe(141);
  });

  it('applies a published profile to an open draft (lock holder, current rowVersion)', async () => {
    const est = await newEstimate(`Synthetic · apply ${run}`);
    const estimateId = est.json.id;
    const draft = await db().estimateVersion.findFirstOrThrow({ where: { estimateId } });
    expect(draft.profileId).toBe(globalId);
    const apply = (who: Who, rowVersion: number, id = profileId) =>
      call(applyRoute.POST, {
        who,
        method: 'POST',
        params: { estimateId },
        body: { profileId: id, rowVersion },
        lockToken: est.json.lockToken,
      });
    expect((await apply('dev-viewer', draft.rowVersion)).status).toBe(403);
    expect((await apply('dev-lead', draft.rowVersion)).status).toBe(409); // no lock
    const stale = await apply('dev-estimator', draft.rowVersion + 5);
    expect(stale.status).toBe(409);
    expect(reason(stale.json)).toBe('STALE');
    const res = await apply('dev-estimator', draft.rowVersion);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.profileId).toBe(profileId);
    expect(res.json.rowVersion).toBe(draft.rowVersion + 1);
    expect(res.json.uncalibrated).toBe(141);
    expect(
      await db().auditEvent.count({
        where: { action: 'estimate.draft.profile.apply', entityId: draft.id },
      }),
    ).toBe(1);

    // Retire it: estimates keep their values, but it can no longer be applied.
    expect((await status(retire.POST, 'dev-lead')).json.status).toBe('RETIRED');
    const after = await apply('dev-estimator', res.json.rowVersion);
    expect(after.status).toBe(422);
  });

  it('keeps the last published global profile', async () => {
    const published = await db().assumptionProfile.count({
      where: { scope: 'GLOBAL', status: 'PUBLISHED' },
    });
    const res = await status(retire.POST, 'dev-admin', globalId);
    if (published === 1) {
      expect(res.status).toBe(409);
      expect(reason(res.json)).toBe('LAST_GLOBAL');
    } else {
      // Another published global exists from an earlier run; put this one back.
      expect(res.status).toBe(200);
      await db().assumptionProfile.update({
        where: { id: globalId },
        data: { status: 'PUBLISHED' },
      });
    }
    expect((await status(retire.POST, 'dev-lead', globalId)).status).toBe(403);
  });
});
