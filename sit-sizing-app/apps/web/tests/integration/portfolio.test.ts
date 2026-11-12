import { EstimateResult } from '@sit/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import * as exportRoute from '@/app/api/v1/portfolio/export/route';
import * as portfolio from '@/app/api/v1/portfolio/route';
import { DEV_USER_HEADER } from '@/server/auth/current-user';
import { db } from '@/server/db';
import { call, seeded, type Who } from './helpers';

/** R-01 through the route handler: totals equal the sum of the underlying versions. */
let demo: string;
let other: string;

beforeAll(async () => {
  const s = await seeded();
  demo = s.demo.id;
  other = s.other.id;
});

const get = (who: Who, query = '') =>
  call(portfolio.GET, { who, path: `/portfolio${query ? `?${query}` : ''}` });

/** What the portfolio should contain, straight from the database. */
async function expected(projectIds: string[], status: 'approved' | 'latest') {
  const estimates = await db().estimate.findMany({
    where: { projectId: { in: projectIds }, archived: false, project: { archived: false } },
    select: {
      id: true,
      versions: {
        where: status === 'approved' ? { status: 'APPROVED' } : { status: { not: 'DRAFT' } },
        orderBy: { number: 'desc' },
        take: 1,
        select: { number: true, result: true },
      },
    },
  });
  const versions = estimates.flatMap((e) => (e.versions[0] ? [e.versions[0]] : []));
  const results = versions.map((v) => EstimateResult.parse(v.result));
  return {
    estimates: versions.length,
    fte: results.reduce((s, r) => s + r.detailed.fte, 0),
    cases: results.reduce((s, r) => s + r.detailed.cases, 0),
    hours: results.reduce((s, r) => s + r.detailed.hours, 0),
  };
}

describe('GET /portfolio (R-01)', () => {
  it('totals equal the sum of the underlying versions, for both statuses', async () => {
    for (const status of ['approved', 'latest'] as const) {
      const res = await get('dev-lead', `status=${status}`);
      expect(res.status, JSON.stringify(res.json)).toBe(200);
      const want = await expected([demo], status);
      expect(res.json.total.estimates).toBe(want.estimates);
      expect(res.json.total.fte).toBeCloseTo(want.fte, 9);
      expect(res.json.total.cases).toBe(want.cases);
      expect(res.json.total.hours).toBeCloseTo(want.hours, 6);
      const rowSum = res.json.projects
        .flatMap((p: { rows: { fte: number }[] }) => p.rows)
        .reduce((s: number, r: { fte: number }) => s + r.fte, 0);
      expect(rowSum).toBeCloseTo(res.json.total.fte, 9);
    }
    // latest includes at least the seeded example's saved version
    expect((await get('dev-lead', 'status=latest')).json.total.estimates).toBeGreaterThan(0);
  });

  it('shows a QE Lead only the projects they lead', async () => {
    const res = await get('dev-lead');
    const ids = res.json.projects.map((p: { projectId: string }) => p.projectId);
    expect(ids.every((id: string) => id === demo)).toBe(true);
    expect((await get('dev-lead', `projectIds=${other}`)).status).toBe(404);
    expect((await get('dev-lead', `projectIds=${demo}`)).status).toBe(200);
  });

  it('is for QE Leads and Admins only', async () => {
    expect((await get('dev-estimator')).status).toBe(403);
    expect((await get('dev-viewer')).status).toBe(403);
    expect((await get(null)).status).toBe(401);
    const admin = await get('dev-admin', 'status=latest');
    expect(admin.status).toBe(200);
    const want = await expected(
      (await db().project.findMany({ select: { id: true } })).map((p) => p.id),
      'latest',
    );
    expect(admin.json.total.estimates).toBe(want.estimates);
    expect((await get('dev-admin', 'projectIds=cm0nonexistent00000000000')).status).toBe(404);
    expect((await get('dev-admin', 'status=everything')).status).toBe(400);
  });

  it('exports the same figures as CSV', async () => {
    const res = await exportRoute.GET(
      new Request('http://localhost:3000/api/v1/portfolio/export?status=latest&lang=en', {
        headers: { [DEV_USER_HEADER]: 'dev-lead' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="sit-sizing-portfolio-latest.csv"',
    );
    // Keep the BOM: TextDecoder strips it unless told not to.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    const lines = text.trimEnd().split('\r\n');
    expect(lines[0]).toMatch(/^﻿Project,Estimate,Version,/);
    const total = lines.at(-1)!.split(',');
    expect(total[0]).toBe('Total');
    const want = await expected([demo], 'latest');
    expect(Number(total[9])).toBe(want.cases);
  });
});
