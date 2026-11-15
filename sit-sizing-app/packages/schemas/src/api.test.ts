import { describe, expect, it } from 'vitest';
import {
  DraftPatch,
  Me,
  MeUpdate,
  MembersPut,
  PageQuery,
  ProjectCreate,
  ProjectUpdate,
  TourKey,
  TourUpdate,
} from './api';

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

  it('MeUpdate accepts only the supported languages', () => {
    expect(MeUpdate.safeParse({ locale: 'vi' }).success).toBe(true);
    expect(MeUpdate.safeParse({ locale: 'fr' }).success).toBe(false);
    expect(MeUpdate.safeParse({}).success).toBe(false);
  });
});

describe('tours', () => {
  it('TourKey is a lower-case id with a 1-3 digit version', () => {
    expect(TourKey.safeParse('first-estimate@1').success).toBe(true);
    for (const bad of ['First@1', 'tour', 'x@1234']) {
      expect(TourKey.safeParse(bad).success).toBe(false);
    }
  });

  it('TourKey is at most 64 characters', () => {
    expect(TourKey.safeParse(`${'a'.repeat(62)}@1`).success).toBe(true);
    expect(TourKey.safeParse(`${'a'.repeat(63)}@1`).success).toBe(false);
  });

  it('TourUpdate carries at most 100 keys', () => {
    const keys = (n: number) =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`t${i}@1`, { status: 'skipped' }]));
    expect(TourUpdate.safeParse(keys(100)).success).toBe(true);
    expect(TourUpdate.safeParse(keys(101)).success).toBe(false);
    expect(MeUpdate.safeParse({ tours: keys(101) }).success).toBe(false);
  });

  it('MeUpdate accepts tours alone, and null to remove a key', () => {
    const set = MeUpdate.parse({ tours: { 'first-estimate@1': { status: 'skipped' } } });
    expect(set.locale).toBeUndefined();
    expect(MeUpdate.safeParse({ tours: { 'first-estimate@1': null } }).success).toBe(true);
  });

  it('MeUpdate rejects empty bodies, bad keys and unknown statuses', () => {
    expect(MeUpdate.safeParse({}).success).toBe(false);
    expect(MeUpdate.safeParse({ tours: { 'bad key': { status: 'completed' } } }).success).toBe(
      false,
    );
    expect(MeUpdate.safeParse({ tours: { 'first-estimate@1': { status: 'seen' } } }).success).toBe(
      false,
    );
  });

  it('Me carries tours, createdAt and lastLoginAt', () => {
    const sample = {
      id: 'clx0synthetic0001',
      displayName: 'Sample User',
      email: 'sample.user@example.test',
      globalRole: 'USER',
      locale: 'en',
      memberships: [],
      tours: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: null,
    };
    expect(Me.parse(sample).lastLoginAt).toBeNull();
  });
});
