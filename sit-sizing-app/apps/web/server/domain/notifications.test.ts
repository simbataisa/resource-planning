import { describe, expect, it } from 'vitest';
import {
  afterAttempt,
  backoffMinutes,
  errorSummary,
  recipients,
  type Person,
} from './notifications';

const p = (id: string, over: Partial<Person> = {}): Person => ({
  id,
  active: true,
  globalRole: 'USER',
  projectRole: null,
  ...over,
});

describe('notification recipients (N-01)', () => {
  const people = [
    p('est', { projectRole: 'ESTIMATOR' }),
    p('lead', { projectRole: 'QE_LEAD' }),
    p('lead2', { projectRole: 'QE_LEAD', active: false }),
    p('viewer', { projectRole: 'VIEWER' }),
    p('admin', { globalRole: 'ADMIN' }),
    p('otherLead', { leadsAnyProject: true }),
  ];

  it('tells active QE Leads about a submission, never the submitter', () => {
    expect(recipients({ kind: 'SUBMITTED', actorId: 'est' }, people)).toEqual(['lead']);
    expect(recipients({ kind: 'SUBMITTED', actorId: 'lead' }, people)).toEqual(['admin']);
  });

  it('tells the author and the submitter about approval or return', () => {
    expect(
      recipients(
        { kind: 'APPROVED', actorId: 'lead', authorId: 'est', submitterId: 'viewer' },
        people,
      ),
    ).toEqual(['est', 'viewer']);
    expect(
      recipients(
        { kind: 'RETURNED', actorId: 'lead', authorId: 'est', submitterId: 'est' },
        people,
      ),
    ).toEqual(['est']);
    expect(
      recipients({ kind: 'APPROVED', actorId: 'est', authorId: 'est', submitterId: null }, people),
    ).toEqual([]);
  });

  it('tells the right people about a published profile', () => {
    expect(
      recipients({ kind: 'PROFILE_PUBLISHED', actorId: 'lead', scope: 'PROJECT' }, people),
    ).toEqual(['est']);
    expect(
      recipients({ kind: 'PROFILE_PUBLISHED', actorId: 'admin', scope: 'GLOBAL' }, people),
    ).toEqual(['otherLead']);
  });
});

describe('delivery retries', () => {
  it('backs off 1, 2, 4, 8, 16, then 30 minutes', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(backoffMinutes)).toEqual([1, 2, 4, 8, 16, 30, 30]);
  });

  it('retries until the limit, then fails', () => {
    expect(afterAttempt(true, 3, 6)).toEqual({ status: 'SENT' });
    expect(afterAttempt(false, 0, 6)).toEqual({
      status: 'PENDING',
      attempts: 1,
      retryInMinutes: 1,
    });
    expect(afterAttempt(false, 4, 6)).toEqual({
      status: 'PENDING',
      attempts: 5,
      retryInMinutes: 16,
    });
    expect(afterAttempt(false, 5, 6)).toEqual({ status: 'FAILED', attempts: 6 });
  });

  it('stores errors without addresses, on one short line', () => {
    const e = new Error('550 mailbox\n  lead@example.invalid unavailable');
    expect(errorSummary(e)).toBe('Error: 550 mailbox <address> unavailable');
    expect(errorSummary('x'.repeat(900))).toHaveLength(500);
  });
});
