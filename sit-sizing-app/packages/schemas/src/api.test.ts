import { describe, expect, it } from 'vitest';
import { DraftPatch, MembersPut, PageQuery, ProjectCreate, ProjectUpdate } from './api';

describe('API request schemas', () => {
  it('ProjectCreate: key is upper-case letters and digits, 2–16 characters', () => {
    expect(ProjectCreate.safeParse({ key: 'DEMO', name: 'Synthetic' }).success).toBe(true);
    expect(ProjectCreate.safeParse({ key: 'demo', name: 'Synthetic' }).success).toBe(false);
    expect(ProjectCreate.safeParse({ key: 'D', name: 'Synthetic' }).success).toBe(false);
    expect(ProjectCreate.safeParse({ key: 'DEMO', name: '   ' }).success).toBe(false);
  });

  it('ProjectUpdate needs at least one field', () => {
    expect(ProjectUpdate.safeParse({}).success).toBe(false);
    expect(ProjectUpdate.safeParse({ archived: true }).success).toBe(true);
  });

  it('MembersPut: unique people and at least one QE Lead', () => {
    const lead = { email: 'lead@example.invalid', role: 'QE_LEAD' };
    expect(MembersPut.safeParse({ members: [lead] }).success).toBe(true);
    expect(MembersPut.safeParse({ members: [{ ...lead, role: 'VIEWER' }] }).success).toBe(false);
    expect(
      MembersPut.safeParse({ members: [lead, { email: 'LEAD@example.invalid', role: 'VIEWER' }] })
        .success,
    ).toBe(false);
    expect(MembersPut.safeParse({ members: [] }).success).toBe(false);
  });

  it('DraftPatch needs a change besides rowVersion', () => {
    expect(DraftPatch.safeParse({ rowVersion: 2 }).success).toBe(false);
    expect(DraftPatch.safeParse({ rowVersion: 2, note: 'Synthetic note' }).success).toBe(true);
    expect(DraftPatch.safeParse({ rowVersion: 0, note: 'x' }).success).toBe(false);
  });

  it('PageQuery coerces the limit from the query string and caps it', () => {
    expect(PageQuery.parse({ limit: '10' })).toEqual({ limit: 10 });
    expect(PageQuery.parse({})).toEqual({ limit: 50 });
    expect(PageQuery.safeParse({ limit: '500' }).success).toBe(false);
  });
});
