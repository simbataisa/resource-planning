import { describe, expect, it } from 'vitest';
import { applicable, decideProfile, managePermission, unknownCalibrationPaths } from './profiles';

describe('profile rules (P-01)', () => {
  it('maps scope to the manage permission', () => {
    expect(managePermission('GLOBAL')).toBe('profile.global.manage');
    expect(managePermission('PROJECT')).toBe('profile.project.manage');
  });

  it('only edits and publishes drafts', () => {
    expect(decideProfile('update', { scope: 'PROJECT', status: 'DRAFT' })).toEqual({
      ok: true,
      to: 'DRAFT',
    });
    expect(decideProfile('publish', { scope: 'PROJECT', status: 'DRAFT' })).toEqual({
      ok: true,
      to: 'PUBLISHED',
    });
    for (const status of ['PUBLISHED', 'RETIRED'] as const) {
      expect(decideProfile('update', { scope: 'GLOBAL', status })).toMatchObject({
        ok: false,
        reason: 'NOT_DRAFT',
      });
      expect(decideProfile('publish', { scope: 'GLOBAL', status })).toMatchObject({
        ok: false,
        reason: 'NOT_DRAFT',
      });
    }
  });

  it('retires published profiles but keeps the last global one', () => {
    expect(decideProfile('retire', { scope: 'PROJECT', status: 'PUBLISHED' })).toEqual({
      ok: true,
      to: 'RETIRED',
    });
    expect(decideProfile('retire', { scope: 'PROJECT', status: 'DRAFT' })).toMatchObject({
      reason: 'NOT_PUBLISHED',
    });
    expect(
      decideProfile(
        'retire',
        { scope: 'GLOBAL', status: 'PUBLISHED' },
        { otherPublishedGlobal: 0 },
      ),
    ).toMatchObject({ reason: 'LAST_GLOBAL' });
    expect(
      decideProfile(
        'retire',
        { scope: 'GLOBAL', status: 'PUBLISHED' },
        { otherPublishedGlobal: 1 },
      ),
    ).toEqual({ ok: true, to: 'RETIRED' });
    expect(
      decideProfile(
        'retire',
        { scope: 'PROJECT', status: 'PUBLISHED' },
        { otherPublishedGlobal: 0 },
      ),
    ).toEqual({ ok: true, to: 'RETIRED' });
  });

  it('flags calibration keys that are not assumption rows', () => {
    expect(unknownCalibrationPaths({ 'cases.api': {}, criticalShare: {} })).toEqual([]);
    expect(unknownCalibrationPaths({ 'cases.api': {}, 'nope.x': {} })).toEqual(['nope.x']);
  });

  it('applies only published profiles in scope', () => {
    const g = { scope: 'GLOBAL' as const, projectId: null };
    const p = { scope: 'PROJECT' as const, projectId: 'p1' };
    expect(applicable({ ...g, status: 'PUBLISHED' }, 'p1')).toBe(true);
    expect(applicable({ ...g, status: 'DRAFT' }, 'p1')).toBe(false);
    expect(applicable({ ...g, status: 'RETIRED' }, 'p1')).toBe(false);
    expect(applicable({ ...p, status: 'PUBLISHED' }, 'p1')).toBe(true);
    expect(applicable({ ...p, status: 'PUBLISHED' }, 'p2')).toBe(false);
  });
});
