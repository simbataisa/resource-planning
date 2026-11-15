import type { Me, TourState } from '@sit/schemas';
import type { TourDefinition } from './types';

/** Looks the id up in the server copy and the browser copy; either may say it was closed. */
function entries(id: string, me: Me, local: TourState) {
  return [me.tours[id], local[id]].filter((e): e is NonNullable<typeof e> => e !== undefined);
}

/** True when the tour was finished for good (completed or skipped), in either copy. */
function isDone(id: string, me: Me, local: TourState): boolean {
  return entries(id, me, local).some((e) => e.status === 'completed' || e.status === 'skipped');
}

/**
 * Seen = completed or skipped, or dismissed since the user's last sign-in. A dismissed tour whose
 * `at` is before `lastLoginAt` starts again; with no `lastLoginAt` it counts as seen.
 */
export function isSeen(id: string, me: Me, local: TourState): boolean {
  return entries(id, me, local).some((e) => {
    if (e.status !== 'dismissed') return true;
    if (me.lastLoginAt === null) return true;
    return Date.parse(e.at) >= Date.parse(me.lastLoginAt);
  });
}

/**
 * The tour to start on this page, or null. `pathname` has no locale prefix. Onboarding tours come
 * before feature tours, then registry order.
 */
export function selectTour(
  me: Me,
  pathname: string,
  registry: TourDefinition[],
  local: TourState,
): TourDefinition | null {
  const onboardingDone = registry.some(
    (t) => t.kind === 'onboarding' && t.audience(me) && isDone(t.id, me, local),
  );
  const offered = (t: TourDefinition): boolean => {
    if (!t.audience(me) || isSeen(t.id, me, local)) return false;
    const first = t.steps[0];
    if (!first || !first.route.test(pathname)) return false;
    if (t.after !== undefined && !isDone(t.after, me, local)) return false;
    if (t.kind === 'feature') {
      if (!(Date.parse(t.since) > Date.parse(me.createdAt))) return false;
      if (!onboardingDone) return false;
    }
    return true;
  };
  return (
    registry.find((t) => t.kind === 'onboarding' && offered(t)) ??
    registry.find((t) => t.kind === 'feature' && offered(t)) ??
    null
  );
}

/**
 * The onboarding tour for this user's role, for "Take the tour": the first onboarding tour whose
 * audience matches, whatever was seen and whatever `after` says.
 */
export function onboardingFor(me: Me, registry: TourDefinition[]): TourDefinition | null {
  return registry.find((t) => t.kind === 'onboarding' && t.audience(me)) ?? null;
}
