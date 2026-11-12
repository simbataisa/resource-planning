import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as audit from '@/app/api/v1/audit/route';
import * as me from '@/app/api/v1/me/route';
import * as oneUser from '@/app/api/v1/users/[userId]/route';
import * as users from '@/app/api/v1/users/route';
import { db } from '@/server/db';
import { call, seeded, type Who } from './helpers';

/** H-01 through the route handlers: audit visibility, user activation, self-protection. */
let demo: string;
let other: string;
let viewerId: string;
let adminId: string;

beforeAll(async () => {
  const s = await seeded();
  demo = s.demo.id;
  other = s.other.id;
  viewerId = (await db().user.findUniqueOrThrow({ where: { subject: 'dev-viewer' } })).id;
  adminId = (await db().user.findUniqueOrThrow({ where: { subject: 'dev-admin' } })).id;
});
afterAll(async () => {
  await db().user.update({ where: { id: viewerId }, data: { active: true } });
});

const getAudit = (who: Who, query = '') =>
  call(audit.GET, { who, path: `/audit${query ? `?${query}` : ''}` });
const patch = (who: Who, id: string, active: boolean) =>
  call(oneUser.PATCH, { who, method: 'PATCH', params: { userId: id }, body: { active } });

describe('GET /audit (H-01)', () => {
  it('shows a QE Lead the events of a project they lead, newest first', async () => {
    const res = await getAudit('dev-lead', `projectId=${demo}&limit=20`);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.items.length).toBeGreaterThan(0);
    expect(res.json.items.every((e: { project: { id: string } }) => e.project?.id === demo)).toBe(
      true,
    );
    const times = res.json.items.map((e: { at: string }) => e.at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('pages with a cursor and filters by action prefix', async () => {
    const first = await getAudit('dev-admin', 'limit=2');
    expect(first.json.items).toHaveLength(2);
    expect(first.json.nextCursor).toBe(first.json.items[1].id);
    const next = await getAudit('dev-admin', `limit=2&cursor=${first.json.nextCursor}`);
    expect(next.json.items[0].id).not.toBe(first.json.items[1].id);
    const versions = await getAudit('dev-admin', 'action=estimate.version.&limit=50');
    expect(
      versions.json.items.every((e: { action: string }) =>
        e.action.startsWith('estimate.version.'),
      ),
    ).toBe(true);
    const none = await getAudit('dev-admin', 'from=2000-01-01&to=2000-01-02');
    expect(none.json.items).toEqual([]);
  });

  it('keeps everyone else out', async () => {
    expect((await getAudit('dev-lead')).status).toBe(403); // all projects: Admins only
    expect((await getAudit('dev-estimator', `projectId=${demo}`)).status).toBe(403);
    expect((await getAudit('dev-lead', `projectId=${other}`)).status).toBe(404);
    expect((await getAudit(null)).status).toBe(401);
    expect((await getAudit('dev-admin', 'from=13-11-2026')).status).toBe(400);
  });
});

describe('users (H-01)', () => {
  it('lists users with their project roles, for Admins only', async () => {
    const res = await call(users.GET, { who: 'dev-admin', path: '/users?q=synthetic' });
    expect(res.status).toBe(200);
    const lead = res.json.items.find((u: { email: string }) => u.email === 'lead@example.invalid');
    expect(lead).toMatchObject({ globalRole: 'USER', active: true });
    expect(lead.memberships).toContainEqual(
      expect.objectContaining({ projectId: demo, role: 'QE_LEAD' }),
    );
    expect((await call(users.GET, { who: 'dev-lead', path: '/users' })).status).toBe(403);
  });

  it('deactivates a user, who is then refused, and reactivates them; both audited', async () => {
    expect((await call(me.GET, { who: 'dev-viewer', path: '/me' })).status).toBe(200);
    const off = await patch('dev-admin', viewerId, false);
    expect(off.status).toBe(200);
    expect(off.json.active).toBe(false);
    expect((await call(me.GET, { who: 'dev-viewer', path: '/me' })).status).toBe(401);
    expect((await patch('dev-admin', viewerId, true)).json.active).toBe(true);
    expect((await call(me.GET, { who: 'dev-viewer', path: '/me' })).status).toBe(200);
    const actions = (
      await db().auditEvent.findMany({ where: { entity: 'User', entityId: viewerId } })
    ).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['user.deactivate', 'user.activate']));
  });

  it('never lets an Admin deactivate themselves, and is Admin-only', async () => {
    const self = await patch('dev-admin', adminId, false);
    expect(self.status).toBe(409);
    expect(self.json.error.details[0].reason).toBe('SELF');
    expect((await patch('dev-lead', viewerId, false)).status).toBe(403);
    expect((await patch('dev-admin', 'cm0nonexistent00000000000', false)).status).toBe(404);
  });
});
