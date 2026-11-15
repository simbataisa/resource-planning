/**
 * Tool calls per user per minute (design spec 6.5): a fixed one-minute window kept in
 * memory per instance, set below the API's own `RATE_LIMIT_PER_MINUTE`.
 */
export interface RateLimiter {
  take(key: string): { ok: true } | { ok: false; retryAfter: number };
  /** Number of users with an open window (tests and diagnostics). */
  size(): number;
}

const WINDOW_MS = 60_000;

export function createRateLimiter(opts: { limit: number; now?: () => number }): RateLimiter {
  const now = opts.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();

  function prune(t: number) {
    for (const [key, w] of windows) if (t - w.start >= WINDOW_MS) windows.delete(key);
  }

  return {
    take(key) {
      const t = now();
      prune(t);
      const w = windows.get(key);
      if (!w) {
        windows.set(key, { start: t, count: 1 });
        return { ok: true };
      }
      if (w.count >= opts.limit) {
        return { ok: false, retryAfter: Math.ceil((w.start + WINDOW_MS - t) / 1000) };
      }
      w.count += 1;
      return { ok: true };
    },
    size: () => windows.size,
  };
}
