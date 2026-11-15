import { createHash, randomBytes } from 'node:crypto';

/**
 * Draft lock token (draft lock token design): proof that a request comes from the tab or
 * assistant session that took the lock. Only its SHA-256 is stored; the token itself is
 * returned once and never logged.
 */
export function hashLockToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function newLockToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashLockToken(token) };
}
