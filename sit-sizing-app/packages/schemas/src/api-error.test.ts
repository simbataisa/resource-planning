import { describe, expect, it } from 'vitest';
import { ApiErrorEnvelope } from './api-error';

describe('ApiErrorEnvelope', () => {
  it('accepts the documented shape', () => {
    const parsed = ApiErrorEnvelope.parse({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Team size must be positive',
        details: [{ path: ['team', 'size'] }],
      },
    });
    expect(parsed.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects unknown codes and empty messages', () => {
    expect(ApiErrorEnvelope.safeParse({ error: { code: 'OOPS', message: 'x' } }).success).toBe(
      false,
    );
    expect(ApiErrorEnvelope.safeParse({ error: { code: 'INTERNAL', message: '' } }).success).toBe(
      false,
    );
  });
});
