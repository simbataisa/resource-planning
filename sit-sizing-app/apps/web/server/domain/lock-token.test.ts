import { describe, expect, it } from 'vitest';
import { hashLockToken, newLockToken } from './lock-token';

describe('lock token', () => {
  it('hashes to 64 hex characters, the same every time', () => {
    const h = hashLockToken('synthetic-token');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashLockToken('synthetic-token')).toBe(h);
    expect(hashLockToken('synthetic-token-2')).not.toBe(h);
  });

  it('mints a random base64url token and returns its hash, never storing the token', () => {
    const a = newLockToken();
    const b = newLockToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.hash).toBe(hashLockToken(a.token));
    expect(a.hash).not.toContain(a.token);
  });
});
