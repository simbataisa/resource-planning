import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit';

describe('per-user rate limit (T-11)', () => {
  it('allows the limit per minute, then refuses until the window resets', () => {
    const check = createRateLimiter(3);
    const t = 60_000 * 100 + 10_000; // 10 s into a window
    expect([1, 2, 3].map(() => check('u1', t).allowed)).toEqual([true, true, true]);
    const refused = check('u1', t);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfter).toBe(50);
    expect(check('u2', t).allowed).toBe(true); // per user
    expect(check('u1', t + 50_000).allowed).toBe(true); // next window
  });

  it('forgets old windows when it holds too many users', () => {
    const check = createRateLimiter(1, 2);
    check('a', 0);
    check('b', 0);
    expect(check('c', 60_000).allowed).toBe(true);
    expect(check('a', 60_000).allowed).toBe(true);
  });
});
