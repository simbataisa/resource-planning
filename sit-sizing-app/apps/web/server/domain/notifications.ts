/**
 * Notification rules (design 5.2, 7; release 2 N-01). Pure: services pass the people in.
 *
 * Who hears about what:
 * - SUBMITTED: the project's QE Leads (the people who can approve); Admins when the project
 *   has no other QE Lead.
 * - APPROVED / RETURNED: the version's author and its submitter.
 * - PROFILE_PUBLISHED: project profile → the project's Estimators and QE Leads;
 *   global profile → every QE Lead and Admin.
 * The person who acted never gets a notice about their own action. Inactive users get none.
 */
export type NotificationKind = 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'PROFILE_PUBLISHED';

export interface Person {
  id: string;
  active: boolean;
  globalRole: 'USER' | 'ADMIN';
  /** The person's role in the project concerned, if any. */
  projectRole?: 'VIEWER' | 'ESTIMATOR' | 'QE_LEAD' | null;
  /** True when the person is QE Lead in at least one project (global profiles). */
  leadsAnyProject?: boolean;
}

export type Audience =
  | { kind: 'SUBMITTED'; actorId: string }
  | { kind: 'APPROVED' | 'RETURNED'; actorId: string; authorId: string; submitterId: string | null }
  | { kind: 'PROFILE_PUBLISHED'; actorId: string; scope: 'GLOBAL' | 'PROJECT' };

export function recipients(a: Audience, people: Person[]): string[] {
  const others = people.filter((p) => p.active && p.id !== a.actorId);
  let ids: string[];
  switch (a.kind) {
    case 'SUBMITTED': {
      const leads = others.filter((p) => p.projectRole === 'QE_LEAD');
      ids = (leads.length ? leads : others.filter((p) => p.globalRole === 'ADMIN')).map(
        (p) => p.id,
      );
      break;
    }
    case 'APPROVED':
    case 'RETURNED': {
      const wanted = new Set([a.authorId, a.submitterId].filter(Boolean));
      ids = others.filter((p) => wanted.has(p.id)).map((p) => p.id);
      break;
    }
    case 'PROFILE_PUBLISHED':
      ids = others
        .filter((p) =>
          a.scope === 'PROJECT'
            ? p.projectRole === 'ESTIMATOR' || p.projectRole === 'QE_LEAD'
            : p.globalRole === 'ADMIN' || p.leadsAnyProject,
        )
        .map((p) => p.id);
      break;
  }
  return [...new Set(ids)].sort();
}

/** Minutes to wait before attempt n+1 (n = attempts so far): 1, 2, 4, 8, 16, then 30. */
export function backoffMinutes(attempts: number): number {
  return Math.min(30, 2 ** Math.max(0, attempts - 1));
}

export type DeliveryOutcome =
  | { status: 'SENT' }
  | { status: 'PENDING'; attempts: number; retryInMinutes: number }
  | { status: 'FAILED'; attempts: number };

/** What to record after one delivery attempt. */
export function afterAttempt(
  ok: boolean,
  attemptsBefore: number,
  maxAttempts: number,
): DeliveryOutcome {
  if (ok) return { status: 'SENT' };
  const attempts = attemptsBefore + 1;
  if (attempts >= maxAttempts) return { status: 'FAILED', attempts };
  return { status: 'PENDING', attempts, retryInMinutes: backoffMinutes(attempts) };
}

/** A delivery error as stored: one line, at most 500 characters, no addresses. */
export function errorSummary(err: unknown): string {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<address>')
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}
