import { describe, expect, it } from 'vitest';
import { decideReview } from './review';

const v = (
  status: 'DRAFT' | 'SAVED' | 'SUBMITTED' | 'APPROVED',
  submittedById: string | null = null,
) => ({
  status,
  createdById: 'author',
  submittedById,
});

describe('approval workflow (V-01)', () => {
  it('submits a saved version, one at a time', () => {
    expect(decideReview('submit', v('SAVED'), 'author', { otherSubmitted: false })).toEqual({
      ok: true,
      to: 'SUBMITTED',
    });
    expect(decideReview('submit', v('SAVED'), 'author', { otherSubmitted: true })).toMatchObject({
      reason: 'ALREADY_SUBMITTED',
    });
    expect(decideReview('submit', v('DRAFT'), 'author', { otherSubmitted: false })).toMatchObject({
      reason: 'WRONG_STATUS',
    });
  });

  it('approves or returns only submitted versions', () => {
    expect(
      decideReview('approve', v('SUBMITTED', 'submitter'), 'lead', { otherSubmitted: false }),
    ).toEqual({ ok: true, to: 'APPROVED' });
    expect(
      decideReview('return', v('SUBMITTED', 'submitter'), 'lead', { otherSubmitted: false }),
    ).toEqual({ ok: true, to: 'SAVED' });
    expect(decideReview('approve', v('SAVED'), 'lead', { otherSubmitted: false })).toMatchObject({
      reason: 'WRONG_STATUS',
    });
    expect(decideReview('return', v('APPROVED'), 'lead', { otherSubmitted: false })).toMatchObject({
      reason: 'WRONG_STATUS',
    });
  });

  it('never lets the author or the submitter approve (segregation of duties)', () => {
    expect(
      decideReview('approve', v('SUBMITTED', 'submitter'), 'author', { otherSubmitted: false }),
    ).toMatchObject({ reason: 'SEGREGATION_OF_DUTIES' });
    expect(
      decideReview('approve', v('SUBMITTED', 'submitter'), 'submitter', { otherSubmitted: false }),
    ).toMatchObject({ reason: 'SEGREGATION_OF_DUTIES' });
    // Returning your own submission is allowed: it only sends the version back.
    expect(
      decideReview('return', v('SUBMITTED', 'author'), 'author', { otherSubmitted: false }),
    ).toEqual({ ok: true, to: 'SAVED' });
  });
});
