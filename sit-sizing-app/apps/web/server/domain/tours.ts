import type { TourState, TourUpdate } from '@sit/schemas';

export const MAX_TOURS = 100;

/** Applies a tour update to the stored state: new or changed keys get `at = now`, null removes a key, and only the newest 100 are kept. */
export function mergeTours(stored: TourState, update: TourUpdate, now: Date): TourState {
  const next: TourState = { ...stored };
  for (const [key, value] of Object.entries(update)) {
    if (value === null) delete next[key];
    else next[key] = { status: value.status, at: now.toISOString() };
  }
  const keys = Object.keys(next);
  if (keys.length <= MAX_TOURS) return next;
  keys.sort((a, b) => next[a]!.at.localeCompare(next[b]!.at));
  for (const key of keys.slice(0, keys.length - MAX_TOURS)) delete next[key];
  return next;
}
