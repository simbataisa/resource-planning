/**
 * Authorisation (design 10.5): one permission matrix and one authorize() function,
 * used by every route handler and server component. Pure: no I/O.
 * Changes here need human security review (AGENTS.md rule 13).
 */
export type GlobalRole = 'USER' | 'ADMIN';
export type ProjectRole = 'VIEWER' | 'ESTIMATOR' | 'QE_LEAD';

export interface Principal {
  id: string;
  globalRole: GlobalRole;
  /** projectId → role in that project. */
  memberships: Readonly<Record<string, ProjectRole>>;
}

const RANK: Record<ProjectRole, number> = { VIEWER: 1, ESTIMATOR: 2, QE_LEAD: 3 };

type Rule = { scope: 'global'; role: GlobalRole } | { scope: 'project'; role: ProjectRole };

/** The permission matrix. Admin can do everything; everyone else needs the listed role. */
export const PERMISSIONS = {
  'project.list': { scope: 'global', role: 'USER' },
  'project.create': { scope: 'global', role: 'ADMIN' },
  'project.read': { scope: 'project', role: 'VIEWER' },
  'project.update': { scope: 'project', role: 'QE_LEAD' },
  'project.members.manage': { scope: 'project', role: 'QE_LEAD' },

  'estimate.list': { scope: 'project', role: 'VIEWER' },
  'estimate.read': { scope: 'project', role: 'VIEWER' },
  'estimate.create': { scope: 'project', role: 'ESTIMATOR' },
  'estimate.export': { scope: 'project', role: 'VIEWER' },

  'draft.create': { scope: 'project', role: 'ESTIMATOR' },
  'draft.lock': { scope: 'project', role: 'ESTIMATOR' },
  'draft.lock.takeover': { scope: 'project', role: 'QE_LEAD' },
  'draft.edit': { scope: 'project', role: 'ESTIMATOR' },

  'version.save': { scope: 'project', role: 'ESTIMATOR' },
  'version.submit': { scope: 'project', role: 'ESTIMATOR' },
  'version.approve': { scope: 'project', role: 'QE_LEAD' },
  'version.return': { scope: 'project', role: 'QE_LEAD' },

  'profile.global.read': { scope: 'global', role: 'USER' },
  'profile.global.manage': { scope: 'global', role: 'ADMIN' },
  'profile.project.read': { scope: 'project', role: 'VIEWER' },
  'profile.project.manage': { scope: 'project', role: 'QE_LEAD' },

  'actuals.read': { scope: 'project', role: 'VIEWER' },
  'actuals.record': { scope: 'project', role: 'ESTIMATOR' },

  /** Portfolio roll-up (release 3, R-01): QE Leads for their projects, Admins for all. */
  'portfolio.read': { scope: 'project', role: 'QE_LEAD' },

  'audit.read.project': { scope: 'project', role: 'QE_LEAD' },
  'audit.read.all': { scope: 'global', role: 'ADMIN' },
  'user.manage': { scope: 'global', role: 'ADMIN' },
} as const satisfies Record<string, Rule>;

export type Action = keyof typeof PERMISSIONS;

/**
 * not-found: the caller is not a member, so the project must look absent (design 10.5:
 * cross-project access returns 404, not 403, to avoid leaking existence).
 * forbidden: the caller is a member but the role is too low.
 */
export type Decision = { allowed: true } | { allowed: false; reason: 'not-found' | 'forbidden' };

export function authorize(user: Principal, action: Action, projectId?: string): Decision {
  if (user.globalRole === 'ADMIN') return { allowed: true };
  const rule: Rule = PERMISSIONS[action];
  if (rule.scope === 'global') {
    return rule.role === 'USER' ? { allowed: true } : { allowed: false, reason: 'forbidden' };
  }
  if (!projectId) return { allowed: false, reason: 'not-found' };
  const role = user.memberships[projectId];
  if (!role) return { allowed: false, reason: 'not-found' };
  return RANK[role] >= RANK[rule.role]
    ? { allowed: true }
    : { allowed: false, reason: 'forbidden' };
}

export function can(user: Principal, action: Action, projectId?: string): boolean {
  return authorize(user, action, projectId).allowed;
}
