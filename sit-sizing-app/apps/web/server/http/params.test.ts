import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { lockTokenOf } from './params';

function req(token?: string): Request {
  const headers = new Headers();
  if (token !== undefined) headers.set('X-Lock-Token', token);
  return new Request('http://localhost/api/v1/estimates/e/draft', { headers });
}

describe('lockTokenOf', () => {
  it('returns the token, or undefined when the header is absent or empty', () => {
    expect(lockTokenOf(req('tok-synthetic-1'))).toBe('tok-synthetic-1');
    expect(lockTokenOf(req())).toBeUndefined();
    expect(lockTokenOf(req(''))).toBeUndefined();
  });

  it('rejects a value over 200 characters (→ 400 VALIDATION_FAILED)', () => {
    expect(lockTokenOf(req('a'.repeat(200)))).toHaveLength(200);
    expect(() => lockTokenOf(req('a'.repeat(201)))).toThrow(ZodError);
  });
});
