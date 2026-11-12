import { beforeAll, describe, expect, it } from 'vitest';
import * as estimate from '@/app/api/v1/estimates/[estimateId]/route';
import * as version from '@/app/api/v1/estimates/[estimateId]/versions/[number]/route';
import * as me from '@/app/api/v1/me/route';
import * as openapi from '@/app/api/v1/openapi.json/route';
import * as profiles from '@/app/api/v1/profiles/route';
import * as profile from '@/app/api/v1/profiles/[profileId]/route';
import * as projects from '@/app/api/v1/projects/route';
import * as project from '@/app/api/v1/projects/[projectId]/route';
import * as estimates from '@/app/api/v1/projects/[projectId]/estimates/route';
import { call, seeded, type Who } from './helpers';

/**
 * Every endpoint × role, including cross-project access (design 10.5: a non-member gets
 * 404, not 403). Seed: DEMO has lead/estimator/viewer; the outsider is QE Lead of OTHER only.
 */
const WHO: Who[] = ['dev-admin', 'dev-lead', 'dev-estimator', 'dev-viewer', 'dev-outsider', null];
type Row = Record<Exclude<Who, null> | 'anon', number>;
const row = (
  admin: number,
  lead: number,
  est: number,
  viewer: number,
  outsider: number,
  anon = 401,
): Row => ({
  'dev-admin': admin,
  'dev-lead': lead,
  'dev-estimator': est,
  'dev-viewer': viewer,
  'dev-outsider': outsider,
  anon,
});

let ids: Awaited<ReturnType<typeof seeded>>;
beforeAll(async () => {
  ids = await seeded();
});

let n = 0;
const cases: [string, () => Parameters<typeof call>, Row][] = [
  [
    'GET /projects',
    () => [projects.GET, { who: null, path: '/projects' }],
    row(200, 200, 200, 200, 200),
  ],
  [
    'POST /projects',
    () => [
      projects.POST,
      {
        who: null,
        method: 'POST',
        path: '/projects',
        body: { key: `T${Date.now() % 1e6}${n++}`, name: 'Synthetic' },
      },
    ],
    row(201, 403, 403, 403, 403),
  ],
  [
    'GET /projects/:id',
    () => [project.GET, { who: null, params: { projectId: ids.demo.id } }],
    row(200, 200, 200, 200, 404),
  ],
  [
    'PATCH /projects/:id',
    () => [
      project.PATCH,
      {
        who: null,
        method: 'PATCH',
        params: { projectId: ids.demo.id },
        body: { description: 'Synthetic project for local development' },
      },
    ],
    row(200, 200, 403, 403, 404),
  ],
  [
    'GET /projects/:id/estimates',
    () => [estimates.GET, { who: null, params: { projectId: ids.demo.id } }],
    row(200, 200, 200, 200, 404),
  ],
  [
    'POST /projects/:id/estimates',
    () => [
      estimates.POST,
      {
        who: null,
        method: 'POST',
        params: { projectId: ids.demo.id },
        body: { name: 'Synthetic · rbac', template: 'blank' },
      },
    ],
    row(201, 201, 201, 403, 404),
  ],
  [
    'GET /estimates/:id',
    () => [estimate.GET, { who: null, params: { estimateId: ids.example.id } }],
    row(200, 200, 200, 200, 404),
  ],
  [
    'GET /estimates/:id/versions/1',
    () => [version.GET, { who: null, params: { estimateId: ids.example.id, number: '1' } }],
    row(200, 200, 200, 200, 404),
  ],
  [
    'GET /profiles',
    () => [profiles.GET, { who: null, path: '/profiles' }],
    row(200, 200, 200, 200, 200),
  ],
  [
    'GET /profiles?projectId=DEMO',
    () => [profiles.GET, { who: null, path: `/profiles?projectId=${ids.demo.id}` }],
    row(200, 200, 200, 200, 404),
  ],
  [
    'GET /profiles/:id (global)',
    () => [profile.GET, { who: null, params: { profileId: ids.profile.id } }],
    row(200, 200, 200, 200, 200),
  ],
  ['GET /me', () => [me.GET, { who: null }], row(200, 200, 200, 200, 200)],
  ['GET /openapi.json', () => [openapi.GET, { who: null }], row(200, 200, 200, 200, 200)],
];

describe.each(cases)('%s', (_name, make, expected) => {
  it.each(WHO)('as %s', async (who) => {
    const [handler, opts] = make();
    const res = await call(handler, { ...opts, who });
    expect(res.status, JSON.stringify(res.json)).toBe(expected[who ?? 'anon']);
  });
});

describe('not found and validation', () => {
  it('returns 404 for a missing version and 400 for a bad id', async () => {
    expect(
      (
        await call(version.GET, {
          who: 'dev-viewer',
          params: { estimateId: ids.example.id, number: '99' },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call(version.GET, {
          who: 'dev-viewer',
          params: { estimateId: ids.example.id, number: 'x' },
        })
      ).status,
    ).toBe(400);
  });

  it('lists only my projects, with my role', async () => {
    const res = await call(projects.GET, { who: 'dev-viewer', path: '/projects' });
    expect(res.json.items.map((p: { key: string }) => p.key)).toEqual(['DEMO']);
    expect(res.json.items[0].myRole).toBe('VIEWER');
  });

  it('pages with cursor and limit', async () => {
    const first = await call(projects.GET, { who: 'dev-admin', path: '/projects?limit=1' });
    expect(first.json.items).toHaveLength(1);
    expect(first.json.nextCursor).not.toBeNull();
    const second = await call(projects.GET, {
      who: 'dev-admin',
      path: `/projects?limit=1&cursor=${first.json.nextCursor}`,
    });
    expect(second.json.items[0].id).not.toBe(first.json.items[0].id);
  });
});
