import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS } from '@sit/engine';
import type { Assumptions } from '@sit/schemas';
import {
  applicable,
  decideProfile,
  managePermission,
  profileAssumptions,
  unknownCalibrationPaths,
} from './profiles';

const D = DEFAULT_ASSUMPTIONS as Assumptions;
const withXS2 = (): Assumptions => {
  const a = structuredClone(D);
  for (const t of ['proxies', 'dproxies', 'aproxies', 'ptRoughScen'] as const)
    (a[t] as Record<string, unknown>).XS2 = structuredClone((a[t] as Record<string, unknown>).S);
  a.sizes = [...a.sizes, 'XS2'];
  return a;
};

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
    expect(unknownCalibrationPaths({ 'cases.api': {}, criticalShare: {} }, D)).toEqual([]);
    expect(unknownCalibrationPaths({ 'cases.api': {}, 'nope.x': {} }, D)).toEqual(['nope.x']);
  });

  it('accepts notes for a custom size only when the profile has it (ADR-0021)', () => {
    expect(unknownCalibrationPaths({ 'proxies.XS2': {} }, withXS2())).toEqual([]);
    expect(unknownCalibrationPaths({ 'proxies.XS2': {} }, D)).toEqual(['proxies.XS2']);
  });

  it('copies the notes of custom-size rows into the assumptions it hands out (ADR-0021)', () => {
    const note = { source: 'Synthetic pilot' };
    const a = profileAssumptions(withXS2(), {
      'proxies.XS2': note,
      sampleFE: note,
      'proxies.S': note,
    });
    expect(a.sizeNotes).toEqual({ 'proxies.XS2': note });
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
