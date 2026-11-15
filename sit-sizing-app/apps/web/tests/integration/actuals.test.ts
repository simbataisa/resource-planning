import { beforeAll, describe, expect, it } from 'vitest';
import * as one from '@/app/api/v1/estimates/[estimateId]/versions/[number]/actuals/[actualsId]/route';
import * as actuals from '@/app/api/v1/estimates/[estimateId]/versions/[number]/actuals/route';
import * as approve from '@/app/api/v1/estimates/[estimateId]/versions/[number]/approve/route';
import * as submit from '@/app/api/v1/estimates/[estimateId]/versions/[number]/submit/route';
import * as versions from '@/app/api/v1/estimates/[estimateId]/versions/route';
import * as estimates from '@/app/api/v1/projects/[projectId]/estimates/route';
import { db } from '@/server/db';
import { call, seeded, type Who } from './helpers';

/** P-02 through the route handlers: approved versions only, variance from the stored result. */
let estimateId: string;
const run = Date.now().toString(36);
const reason = (json: { error: { details?: { reason?: string }[] } }) =>
  json.error.details?.[0]?.reason;

const p = (n = 1) => ({ estimateId, number: String(n) });
const post = (who: Who, body: unknown, n = 1) =>
  call(actuals.POST, { who, method: 'POST', params: p(n), body });
const cycle = {
  cycleLabel: `Synthetic cycle 1 · ${run}`,
  data: {
    executedCases: 3900,
    totalHours: 3800,
    executionHours: 1300,
    retestedCases: 780,
    groups: [{ group: 'api', cases: 180, hours: 120 }],
  },
  note: 'Synthetic data',
};

beforeAll(async () => {
  const projectId = (await seeded()).demo.id;
  const est = await call(estimates.POST, {
    who: 'dev-estimator',
    method: 'POST',
    params: { projectId },
    body: { name: `Synthetic · actuals ${run}` },
  });
  estimateId = est.json.id;
  await call(versions.POST, {
    who: 'dev-estimator',
    method: 'POST',
    params: { estimateId },
    body: {},
    lockToken: est.json.lockToken,
  });
});

describe('actuals (P-02)', () => {
  it('refuses a version that is not approved', async () => {
    const res = await post('dev-estimator', cycle);
    expect(res.status).toBe(409);
    expect(reason(res.json)).toBe('NOT_APPROVED');
    await call(submit.POST, { who: 'dev-estimator', method: 'POST', params: p(), body: {} });
    await call(approve.POST, { who: 'dev-lead', method: 'POST', params: p(), body: {} });
  });

  it('records a cycle with its variance, computed from the stored estimate', async () => {
    const v = await db().estimateVersion.findFirstOrThrow({ where: { estimateId, number: 1 } });
    const stored = v.result as {
      detailed: { cases: number; hours: number; groups: { api: { cases: number } } };
    };
    const res = await post('dev-estimator', cycle);
    expect(res.status, JSON.stringify(res.json)).toBe(201);
    const [cases, hours] = res.json.variance.totals;
    expect(cases).toMatchObject({ key: 'cases', estimate: stored.detailed.cases, actual: 3900 });
    expect(cases.delta).toBe(3900 - stored.detailed.cases);
    expect(hours.pct).toBeCloseTo((3800 - stored.detailed.hours) / stored.detailed.hours, 12);
    expect(res.json.variance.groups[0]).toMatchObject({
      key: 'api.cases',
      estimate: stored.detailed.groups.api.cases,
      actual: 180,
    });
    const rates = Object.fromEntries(
      res.json.variance.rates.map((r: { key: string; actual: number | null }) => [r.key, r.actual]),
    );
    expect(rates).toEqual({
      minutesPerCase: 20, // 1300 h × 60 / 3900
      designMinutesPerCase: null,
      retestRate: 0.2, // 780 / 3900
      productiveHoursPerDay: null,
    });
    expect(
      await db().auditEvent.count({ where: { action: 'actuals.record', entityId: res.json.id } }),
    ).toBe(1);
  });

  it('keeps one record per cycle name, and checks roles and input', async () => {
    const again = await post('dev-estimator', cycle);
    expect(again.status).toBe(409);
    expect(reason(again.json)).toBe('CYCLE_EXISTS');
    expect((await post('dev-viewer', { ...cycle, cycleLabel: 'x' })).status).toBe(403);
    expect((await post('dev-outsider', { ...cycle, cycleLabel: 'x' })).status).toBe(404);
    expect(
      (
        await post('dev-estimator', {
          cycleLabel: 'bad',
          data: { executedCases: -1, totalHours: 1 },
        })
      ).status,
    ).toBe(400);
  });

  it('lists cycles for a Viewer', async () => {
    const res = await call(actuals.GET, { who: 'dev-viewer', params: p() });
    expect(res.status).toBe(200);
    expect(res.json.items).toHaveLength(1);
    expect(res.json.items[0]).toMatchObject({
      cycleLabel: cycle.cycleLabel,
      note: 'Synthetic data',
    });
  });

  it('lets only the recorder or a QE Lead remove a record', async () => {
    const id = (await call(actuals.GET, { who: 'dev-viewer', params: p() })).json.items[0].id;
    const del = (who: Who) =>
      call(one.DELETE, { who, method: 'DELETE', params: { ...p(), actualsId: id } });
    expect((await del('dev-viewer')).status).toBe(403);
    expect((await del('dev-lead')).status).toBe(204);
    expect((await del('dev-lead')).status).toBe(404);
    expect(await db().auditEvent.count({ where: { action: 'actuals.delete', entityId: id } })).toBe(
      1,
    );
  });
});
