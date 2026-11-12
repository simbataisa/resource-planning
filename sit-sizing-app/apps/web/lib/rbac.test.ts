import { describe, expect, it } from 'vitest';
import { authorize, can, PERMISSIONS, type Action, type Principal, type ProjectRole } from './rbac';

const P1 = 'project-1';
const P2 = 'project-2';
const member = (role: ProjectRole): Principal => ({
  id: `u-${role}`,
  globalRole: 'USER',
  memberships: { [P1]: role },
});
const admin: Principal = { id: 'u-admin', globalRole: 'ADMIN', memberships: {} };
const outsider: Principal = { id: 'u-out', globalRole: 'USER', memberships: { [P2]: 'QE_LEAD' } };

/** Expected matrix, written out independently of PERMISSIONS (design 10.5 table). */
const EXPECTED: Record<Action, { VIEWER: boolean; ESTIMATOR: boolean; QE_LEAD: boolean }> = {
  'project.list': { VIEWER: true, ESTIMATOR: true, QE_LEAD: true },
  'project.create': { VIEWER: false, ESTIMATOR: false, QE_LEAD: false },
  'project.read': { VIEWER: true, ESTIMATOR: true, QE_LEAD: true },
  'project.update': { VIEWER: false, ESTIMATOR: false, QE_LEAD: true },
  'project.members.manage': { VIEWER: false, ESTIMATOR: false, QE_LEAD: true },
  'estimate.list': { VIEWER: true, ESTIMATOR: true, QE_LEAD: true },
  'estimate.read': { VIEWER: true, ESTIMATOR: true, QE_LEAD: true },
  'estimate.create': { VIEWER: false, ESTIMATOR: true, QE_LEAD: true },
  'estimate.export': { VIEWER: true, ESTIMATOR: true, QE_LEAD: true },
  'draft.create': { VIEWER: false, ESTIMATOR: true, QE_LEAD: true },
  'draft.lock': { VIEWER: false, ESTIMATOR: true, QE_LEAD: true },
  'draft.lock.takeover': { VIEWER: false, ESTIMATOR: false, QE_LEAD: true },
  'draft.edit': { VIEWER: false, ESTIMATOR: true, QE_LEAD: true },
  'version.save': { VIEWER: false, ESTIMATOR: true, QE_LEAD: true },
  'version.submit': { VIEWER: false, ESTIMATOR: true, QE_LEAD: true },
  'version.approve': { VIEWER: false, ESTIMATOR: false, QE_LEAD: true },
  'version.return': { VIEWER: false, ESTIMATOR: false, QE_LEAD: true },
  'profile.global.read': { VIEWER: true, ESTIMATOR: true, QE_LEAD: true },
  'profile.global.manage': { VIEWER: false, ESTIMATOR: false, QE_LEAD: false },
  'profile.project.read': { VIEWER: true, ESTIMATOR: true, QE_LEAD: true },
  'profile.project.manage': { VIEWER: false, ESTIMATOR: false, QE_LEAD: true },
  'actuals.read': { VIEWER: true, ESTIMATOR: true, QE_LEAD: true },
  'actuals.record': { VIEWER: false, ESTIMATOR: true, QE_LEAD: true },
  'audit.read.project': { VIEWER: false, ESTIMATOR: false, QE_LEAD: true },
  'audit.read.all': { VIEWER: false, ESTIMATOR: false, QE_LEAD: false },
  'user.manage': { VIEWER: false, ESTIMATOR: false, QE_LEAD: false },
};

const ACTIONS = Object.keys(PERMISSIONS) as Action[];

describe('rbac matrix', () => {
  it('covers every action', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...ACTIONS].sort());
  });

  for (const action of ACTIONS) {
    for (const role of ['VIEWER', 'ESTIMATOR', 'QE_LEAD'] as const) {
      it(`${role} ${EXPECTED[action][role] ? 'can' : 'cannot'} ${action}`, () => {
        const d = authorize(member(role), action, P1);
        expect(d.allowed).toBe(EXPECTED[action][role]);
        if (!d.allowed) expect(d.reason).toBe('forbidden');
      });
    }

    it(`admin can ${action} in any project`, () => {
      expect(can(admin, action, P1)).toBe(true);
    });

    if (PERMISSIONS[action].scope === 'project') {
      it(`${action} in another project looks like "not found"`, () => {
        expect(authorize(outsider, action, P1)).toEqual({ allowed: false, reason: 'not-found' });
        expect(authorize(member('QE_LEAD'), action, P2)).toEqual({
          allowed: false,
          reason: 'not-found',
        });
        expect(authorize(member('QE_LEAD'), action)).toEqual({
          allowed: false,
          reason: 'not-found',
        });
      });
    }
  }
});
