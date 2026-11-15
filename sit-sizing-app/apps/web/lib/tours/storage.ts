import { TourState, type Me, type TourStatus } from '@sit/schemas';

const keyFor = (userId: string) => `sit-tours:${userId}`;

/** The browser copy of a user's tour state. Never throws: blocked storage or bad JSON gives `{}`. */
export function readLocal(userId: string): TourState {
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (raw === null) return {};
    const parsed = TourState.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/** Records how a tour closed. Never throws: the server copy is the fallback. */
export function writeLocal(userId: string, id: string, status: TourStatus, at: string): void {
  try {
    const next: TourState = { ...readLocal(userId), [id]: { status, at } };
    window.localStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    // Storage is unavailable (private window, blocked); tours still work from the server copy.
  }
}

/** Entries in the browser copy that the server copy lacks or holds with a different status. */
export function pendingSync(me: Me, local: TourState): Record<string, { status: TourStatus }> {
  const out: Record<string, { status: TourStatus }> = {};
  for (const [id, entry] of Object.entries(local)) {
    if (me.tours[id]?.status !== entry.status) out[id] = { status: entry.status };
  }
  return out;
}
