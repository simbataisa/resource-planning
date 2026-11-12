/**
 * Per-user API rate limit (design 11, threat model T-11): a fixed one-minute window per user,
 * in memory. Each app instance counts on its own, so the effective limit is per instance; the
 * thresholds come from the non-functional targets (Q10). Sign-in throttling is Keycloak's job.
 */
export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets (for Retry-After). */
  retryAfter: number;
  remaining: number;
}

export function createRateLimiter(limitPerMinute: number, maxKeys = 10_000) {
  const windows = new Map<string, { start: number; count: number }>();
  return function check(key: string, nowMs: number = Date.now()): RateLimitResult {
    const windowStart = Math.floor(nowMs / 60_000) * 60_000;
    let w = windows.get(key);
    if (!w || w.start !== windowStart) {
      if (windows.size >= maxKeys) {
        for (const [k, v] of windows) if (v.start !== windowStart) windows.delete(k);
      }
      w = { start: windowStart, count: 0 };
      windows.set(key, w);
    }
    w.count += 1;
    const retryAfter = Math.max(1, Math.ceil((windowStart + 60_000 - nowMs) / 1000));
    return {
      allowed: w.count <= limitPerMinute,
      retryAfter,
      remaining: Math.max(0, limitPerMinute - w.count),
    };
  };
}
