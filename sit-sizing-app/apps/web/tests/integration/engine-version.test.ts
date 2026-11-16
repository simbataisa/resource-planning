import { ENGINE_VERSION } from '@sit/engine';
import { beforeAll, describe, expect, it } from 'vitest';
import * as compare from '@/app/api/v1/estimates/[estimateId]/compare/route';
import * as draft from '@/app/api/v1/estimates/[estimateId]/draft/route';
import * as one from '@/app/api/v1/estimates/[estimateId]/versions/[number]/route';
import * as versions from '@/app/api/v1/estimates/[estimateId]/versions/route';
import * as estimates from '@/app/api/v1/projects/[projectId]/estimates/route';
import type { Prisma } from '@sit/db';
import { db } from '@/server/db';
import { call, seeded } from './helpers';

/** E-08: stale engine flag data, recompute as a new draft, payloads read in the current shape. */
let estimateId: string;
const run = Date.now().toString(36);

beforeAll(async () => {
  const projectId = (await seeded()).demo.id;
  const est = await call(estimates.POST, {
    who: 'dev-estimator',
    method: 'POST',
    params: { projectId },
    body: { name: `Synthetic · engine ${run}` },
  });
  estimateId = est.json.id;
  await call(versions.POST, {
    who: 'dev-estimator',
    method: 'POST',
    params: { estimateId },
    body: {},
    lockToken: est.json.lockToken,
  });
  // Pretend v1 was saved by an older engine: same inputs, a stored result that differs.
  const v1 = await db().estimateVersion.findFirstOrThrow({ where: { estimateId, number: 1 } });
  const result = structuredClone(v1.result) as { engineVersion: string; detailed: { fte: number } };
  result.engineVersion = '0.9.0';
  result.detailed.fte = 99;
  await db().estimateVersion.update({
    where: { id: v1.id },
    data: { engineVersion: '0.9.0', result, detailedFte: 99 },
  });
});

const getVersion = (n: number) =>
  call(one.GET, { who: 'dev-viewer', params: { estimateId, number: String(n) } });

describe('engine version (E-08)', () => {
  it('keeps the old result and engine version on the saved version', async () => {
    const res = await getVersion(1);
    expect(res.status).toBe(200);
    expect(res.json.engineVersion).toBe('0.9.0');
    expect(res.json.result.detailed.fte).toBe(99);
  });

  it('recomputes as a new draft with the current engine; the old version is unchanged', async () => {
    const res = await call(draft.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { estimateId },
      body: { fromVersion: 1 },
    });
    expect(res.status, JSON.stringify(res.json)).toBe(201);
    expect(res.json).toMatchObject({ number: 2, status: 'DRAFT', engineVersion: ENGINE_VERSION });
    expect(res.json.result.detailed.fte).not.toBe(99);
    expect((await getVersion(1)).json.result.detailed.fte).toBe(99);
    const cmp = await call(compare.GET, {
      who: 'dev-viewer',
      path: `/estimates/${estimateId}/compare?a=1&b=2`,
      params: { estimateId },
    });
    expect(cmp.json.changes).toEqual([]); // same inputs and assumptions…
    expect(cmp.json.results.detailed.a.fte).toBe(99); // …different engine result
    expect(cmp.json.results.detailed.b.fte).toBe(res.json.result.detailed.fte);
  });

  it('refuses a payload saved by a newer release (after a rollback) with 409', async () => {
    const v1 = await db().estimateVersion.findFirstOrThrow({ where: { estimateId, number: 1 } });
    await db().estimateVersion.update({ where: { id: v1.id }, data: { schemaVersion: 99 } });
    const res = await getVersion(1);
    expect(res.status).toBe(409);
    expect(res.json.error.details[0].reason).toBe('NEWER_SCHEMA');
    await db().estimateVersion.update({ where: { id: v1.id }, data: { schemaVersion: 1 } });
    // A version 1 row runs the ADR-0019 upgrade step on read: the full Prisma row (with
    // Decimal columns) must not reach structuredClone.
    expect((await getVersion(1)).status).toBe(200);
  });

  it('reads a version 1 payload with single data values as sizes (ADR-0019)', async () => {
    const v1 = await db().estimateVersion.findFirstOrThrow({ where: { estimateId, number: 1 } });
    const assumptions = structuredClone(v1.assumptions) as Record<string, unknown>;
    const inputs = structuredClone(v1.inputs) as { detail: { data: Record<string, unknown> } };
    Object.assign(assumptions, { dataDesign: 12, dataExec: 6, dataPrepHours: 2.5 });
    Object.assign(inputs.detail.data, { columns: 140, dq: 24 });
    await db().estimateVersion.update({
      where: { id: v1.id },
      data: {
        schemaVersion: 1,
        assumptions: assumptions as Prisma.InputJsonValue,
        inputs: inputs as unknown as Prisma.InputJsonValue,
      },
    });
    const res = await getVersion(1);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.assumptions.dataDesign).toEqual([12, 12, 12]);
    expect(res.json.assumptions.dataPrepHours).toEqual([2.5, 2.5, 2.5]);
    expect(res.json.inputs.detail.data.columns).toEqual([140, 0, 0]);
    expect(res.json.inputs.detail.data.dq).toEqual([24, 0, 0]);
    expect(res.json.result.detailed.fte).toBe(99); // the stored result is never recomputed
  });
});
