/**
 * Assumption profile rules (design 5.2, 9.1; release 2 P-01). Pure: services pass the rows in.
 *
 *   DRAFT --publish--> PUBLISHED --retire--> RETIRED
 *
 * Only a DRAFT can be edited, so a published profile never changes under the estimates
 * that copied it. A default change goes into a new profile (design 6.6 rule 6).
 */
import { ASSUMPTION_PATHS } from '@sit/engine';
import type { Action } from '@/lib/rbac';

type Scope = 'GLOBAL' | 'PROJECT';
type Status = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

export type ProfileAction = 'update' | 'publish' | 'retire';

export type ProfileDecision =
  | { ok: true; to: Status }
  | { ok: false; reason: 'NOT_DRAFT' | 'NOT_PUBLISHED' | 'LAST_GLOBAL'; message: string };

/** The permission that manages a profile in this scope. */
export function managePermission(scope: Scope): Action {
  return scope === 'GLOBAL' ? 'profile.global.manage' : 'profile.project.manage';
}

export function decideProfile(
  action: ProfileAction,
  p: { scope: Scope; status: Status },
  opts: { otherPublishedGlobal: number } = { otherPublishedGlobal: 1 },
): ProfileDecision {
  if (action === 'update' || action === 'publish') {
    if (p.status !== 'DRAFT')
      return {
        ok: false,
        reason: 'NOT_DRAFT',
        message: 'Only a draft profile can be changed or published. Clone it to make changes.',
      };
    return { ok: true, to: action === 'publish' ? 'PUBLISHED' : 'DRAFT' };
  }
  if (p.status !== 'PUBLISHED')
    return {
      ok: false,
      reason: 'NOT_PUBLISHED',
      message: 'Only a published profile can be retired.',
    };
  // New estimates fall back to a published global profile, so one must always remain.
  if (p.scope === 'GLOBAL' && opts.otherPublishedGlobal === 0)
    return {
      ok: false,
      reason: 'LAST_GLOBAL',
      message: 'This is the last published global profile. Publish another one first.',
    };
  return { ok: true, to: 'RETIRED' };
}

const KNOWN = new Set(ASSUMPTION_PATHS);

/** Calibration keys that are not one of the 160 assumption rows. */
export function unknownCalibrationPaths(calibration: Record<string, unknown>): string[] {
  return Object.keys(calibration).filter((k) => !KNOWN.has(k));
}

/** A profile can be applied to an estimate when it is published and in scope for the project. */
export function applicable(
  p: { scope: Scope; status: Status; projectId: string | null },
  projectId: string,
): boolean {
  return p.status === 'PUBLISHED' && (p.scope === 'GLOBAL' || p.projectId === projectId);
}
