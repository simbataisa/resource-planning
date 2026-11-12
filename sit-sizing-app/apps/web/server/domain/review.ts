/**
 * Approval workflow rules (design 5.2, release 2 V-01). Pure: services pass the rows in.
 *
 *   SAVED --submit--> SUBMITTED --approve--> APPROVED (the previous APPROVED becomes SUPERSEDED)
 *                         \--return (with a note)--> SAVED
 *
 * Segregation of duties: the person who wrote the version or submitted it never approves it,
 * whatever their role (Admins included).
 */
export type ReviewAction = 'submit' | 'approve' | 'return';
type Status = 'DRAFT' | 'SAVED' | 'SUBMITTED' | 'APPROVED' | 'SUPERSEDED';

export type ReviewDecision =
  | { ok: true; to: Status }
  | {
      ok: false;
      reason: 'WRONG_STATUS' | 'ALREADY_SUBMITTED' | 'SEGREGATION_OF_DUTIES';
      message: string;
    };

export function decideReview(
  action: ReviewAction,
  v: { status: Status; createdById: string; submittedById: string | null },
  userId: string,
  opts: { otherSubmitted: boolean },
): ReviewDecision {
  if (action === 'submit') {
    if (v.status !== 'SAVED')
      return {
        ok: false,
        reason: 'WRONG_STATUS',
        message: 'Only a saved version can be submitted.',
      };
    if (opts.otherSubmitted)
      return {
        ok: false,
        reason: 'ALREADY_SUBMITTED',
        message: 'Another version of this estimate is waiting for approval.',
      };
    return { ok: true, to: 'SUBMITTED' };
  }
  if (v.status !== 'SUBMITTED')
    return {
      ok: false,
      reason: 'WRONG_STATUS',
      message: 'Only a submitted version can be approved or returned.',
    };
  if (action === 'approve' && (v.createdById === userId || v.submittedById === userId))
    return {
      ok: false,
      reason: 'SEGREGATION_OF_DUTIES',
      message: 'You wrote or submitted this version, so someone else must approve it.',
    };
  return { ok: true, to: action === 'approve' ? 'APPROVED' : 'SAVED' };
}
