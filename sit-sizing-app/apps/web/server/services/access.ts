import { authorize, type Action } from '@/lib/rbac';
import type { CurrentUser } from '../auth/current-user';
import type { DbOrTx } from '../db';
import { HttpError } from '../http/route';

export const notFound = () => new HttpError(404, 'NOT_FOUND', 'Not found.');

/** Throws 404 for non-members (no existence leak) and 403 for members whose role is too low. */
export function ensure(user: CurrentUser, action: Action, projectId?: string): void {
  const d = authorize(user, action, projectId);
  if (d.allowed) return;
  throw d.reason === 'not-found'
    ? notFound()
    : new HttpError(403, 'FORBIDDEN', 'Your role does not allow this.');
}

/** Loads an estimate's project id and checks the action against that project. */
export async function estimateFor(
  tx: DbOrTx,
  user: CurrentUser,
  estimateId: string,
  action: Action,
) {
  const est = await tx.estimate.findUnique({
    where: { id: estimateId },
    select: { id: true, projectId: true, archived: true },
  });
  if (!est) throw notFound();
  ensure(user, action, est.projectId);
  return est;
}

/** Same as ensure() for a project, and 404 when the project does not exist (Admin sees everything). */
export async function projectFor(tx: DbOrTx, user: CurrentUser, projectId: string, action: Action) {
  ensure(user, action, projectId);
  const p = await tx.project.findUnique({ where: { id: projectId } });
  if (!p) throw notFound();
  return p;
}

export interface RequestMeta {
  requestId: string;
}
