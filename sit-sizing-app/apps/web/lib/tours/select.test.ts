import type { Me } from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import { isSeen, onboardingFor, selectTour } from './select';
import { TOURS } from './registry';
import type { TourDefinition } from './types';

const CREATED = '2026-01-01T00:00:00.000Z';
const LOGIN = '2026-06-01T00:00:00.000Z';

const me = (over: Partial<Me> = {}): Me => ({
  id: 'u1',
  displayName: 'Test User',
  email: 'test@example.com',
  globalRole: 'USER',
  locale: 'en',
  memberships: [{ projectId: 'p1', projectKey: 'DEMO', projectName: 'Demo', role: 'ESTIMATOR' }],
  tours: {},
  createdAt: CREATED,
  lastLoginAt: LOGIN,
  ...over,
});

const done = (status: 'completed' | 'skipped' | 'dismissed', at = '2026-03-01T00:00:00.000Z') => ({
  status,
  at,
});

const step = (route: RegExp) => ({
  route,
  target: 'center',
  messageKey: 'tours.x',
  advance: 'next' as const,
});

const isRole = (role: string) => (m: Me) => m.memberships.some((x) => x.role === role);

const reading: TourDefinition = {
  id: 'reading-tour@1',
  kind: 'onboarding',
  since: '2025-12-01T00:00:00.000Z',
  audience: isRole('VIEWER'),
  steps: [step(/^\/projects/)],
};
const firstEstimate: TourDefinition = {
  id: 'first-estimate@1',
  kind: 'onboarding',
  since: '2025-12-01T00:00:00.000Z',
  audience: isRole('ESTIMATOR'),
  steps: [step(/^\/projects/)],
};
const feature: TourDefinition = {
  id: 'compare@1',
  kind: 'feature',
  since: '2026-05-01T00:00:00.000Z',
  audience: () => true,
  steps: [step(/^\/projects/)],
};
const REGISTRY = [feature, firstEstimate, reading];

describe('isSeen', () => {
  it('treats completed and skipped as seen in either copy', () => {
    for (const status of ['completed', 'skipped'] as const) {
      expect(isSeen('a@1', me({ tours: { 'a@1': done(status) } }), {})).toBe(true);
      expect(isSeen('a@1', me(), { 'a@1': done(status) })).toBe(true);
    }
    expect(isSeen('a@1', me(), {})).toBe(false);
  });

  it('is seen when either copy says seen (local completed, server dismissed before login)', () => {
    const m = me({ tours: { 'a@1': done('dismissed', '2026-02-01T00:00:00.000Z') } });
    expect(isSeen('a@1', m, {})).toBe(false);
    expect(isSeen('a@1', m, { 'a@1': done('completed') })).toBe(true);
  });

  it('treats dismissed as seen when there was no earlier login', () => {
    const m = me({ lastLoginAt: null, tours: { 'a@1': done('dismissed') } });
    expect(isSeen('a@1', m, {})).toBe(true);
  });
});

describe('selectTour', () => {
  it('returns an unseen onboarding tour whose route and audience match', () => {
    expect(selectTour(me(), '/projects', REGISTRY, {})?.id).toBe('first-estimate@1');
  });

  it('returns null when the first step route does not match', () => {
    expect(selectTour(me(), '/admin', REGISTRY, {})).toBeNull();
  });

  it('returns null when the audience does not match', () => {
    expect(selectTour(me({ memberships: [] }), '/projects', [firstEstimate], {})).toBeNull();
  });

  it('skips tours completed or skipped in me.tours or local', () => {
    for (const status of ['completed', 'skipped'] as const) {
      expect(
        selectTour(
          me({ tours: { 'first-estimate@1': done(status) } }),
          '/projects',
          [firstEstimate],
          {},
        ),
      ).toBeNull();
      expect(
        selectTour(me(), '/projects', [firstEstimate], { 'first-estimate@1': done(status) }),
      ).toBeNull();
    }
  });

  it('restarts a dismissed tour only when it was dismissed before the last login', () => {
    const before = me({
      tours: { 'first-estimate@1': done('dismissed', '2026-05-01T00:00:00.000Z') },
    });
    const after = me({
      tours: { 'first-estimate@1': done('dismissed', '2026-07-01T00:00:00.000Z') },
    });
    expect(selectTour(before, '/projects', [firstEstimate], {})?.id).toBe('first-estimate@1');
    expect(selectTour(after, '/projects', [firstEstimate], {})).toBeNull();
  });

  it('offers a feature tour only after the matching onboarding tour is completed or skipped', () => {
    const m = me();
    expect(
      selectTour(m, '/projects', [feature, firstEstimate], {
        'first-estimate@1': done('dismissed', '2026-07-01T00:00:00.000Z'),
      }),
    ).toBeNull();
    for (const status of ['completed', 'skipped'] as const) {
      expect(
        selectTour(m, '/projects', [feature, firstEstimate], { 'first-estimate@1': done(status) })
          ?.id,
      ).toBe('compare@1');
    }
  });

  it('never offers a feature tour that shipped before the user was created', () => {
    const old = { ...feature, since: '2025-06-01T00:00:00.000Z' };
    const m = me({ tours: { 'first-estimate@1': done('completed') } });
    expect(selectTour(m, '/projects', [old, firstEstimate], {})).toBeNull();
  });

  it('holds back a tour until its `after` tour is completed or skipped', () => {
    const second: TourDefinition = { ...firstEstimate, id: 'second@1', after: 'first-estimate@1' };
    const m = me();
    expect(selectTour(m, '/projects', [second], {})).toBeNull();
    expect(
      selectTour(m, '/projects', [second], { 'first-estimate@1': done('completed') })?.id,
    ).toBe('second@1');
    expect(selectTour(m, '/projects', [second], { 'first-estimate@1': done('skipped') })?.id).toBe(
      'second@1',
    );
  });

  it('prefers onboarding over feature tours', () => {
    expect(selectTour(me(), '/projects', [feature, firstEstimate], {})?.id).toBe(
      'first-estimate@1',
    );
  });

  it('keeps registry order within a kind', () => {
    const other = { ...firstEstimate, id: 'other@1' };
    expect(selectTour(me(), '/projects', [other, firstEstimate], {})?.id).toBe('other@1');
  });

  it('offers first-estimate when a former Viewer finished reading-tour and is now an Estimator', () => {
    const m = me({ tours: { 'reading-tour@1': done('completed') } });
    expect(selectTour(m, '/projects', [reading, firstEstimate], {})?.id).toBe('first-estimate@1');
  });
});

describe('onboardingFor', () => {
  it('picks the onboarding tour for the role, whatever was seen', () => {
    expect(onboardingFor(me(), TOURS)?.id).toBe('first-estimate@1');
    const viewer = me({
      memberships: [{ projectId: 'p1', projectKey: 'DEMO', projectName: 'Demo', role: 'VIEWER' }],
    });
    expect(onboardingFor(viewer, TOURS)?.id).toBe('reading-tour@1');
    expect(onboardingFor(me({ memberships: [] }), TOURS)?.id).toBe('no-project@1');
    const seen = me({ tours: { 'first-estimate@1': done('completed') } });
    expect(onboardingFor(seen, TOURS)?.id).toBe('first-estimate@1');
  });

  it('ignores feature tours and returns null when nothing matches', () => {
    expect(onboardingFor(me(), [feature])).toBeNull();
    expect(onboardingFor(me({ memberships: [] }), [firstEstimate])).toBeNull();
  });
});
