import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit';

describe('createRateLimiter', () => {
  it('refuses the 61st call in a minute for one user and allows another user', () => {
    let now = 1_000_000;
    const limiter = createRateLimiter({ limit: 60, now: () => now });
    for (let i = 0; i < 60; i++) expect(limiter.take('user-a').ok).toBe(true);
    const refused = limiter.take('user-a');
    expect(refused).toEqual({ ok: false, retryAfter: 60 });
    expect(limiter.take('user-b').ok).toBe(true);

    now += 30_000;
    expect(limiter.take('user-a')).toEqual({ ok: false, retryAfter: 30 });
    now += 30_000;
    expect(limiter.take('user-a').ok).toBe(true);
  });

  it('forgets expired windows', () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 1, now: () => now });
    limiter.take('a');
    limiter.take('b');
    expect(limiter.size()).toBe(2);
    now += 61_000;
    limiter.take('c');
    expect(limiter.size()).toBe(1);
  });

  it('uses the clock by default', () => {
    expect(createRateLimiter({ limit: 1 }).take('a').ok).toBe(true);
  });
});
