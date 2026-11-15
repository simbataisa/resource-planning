import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiErrorCode, ApiErrorEnvelope, KNOWN_API_ERROR_CODES } from './api-error';

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

  it('accepts codes it does not know (ADR-0018) but rejects empty messages', () => {
    const parsed = ApiErrorEnvelope.safeParse({
      error: { code: 'SOME_FUTURE_CODE', message: 'x' },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.error.code).toBe('SOME_FUTURE_CODE');
    expect(ApiErrorEnvelope.safeParse({ error: { code: 'INTERNAL', message: '' } }).success).toBe(
      false,
    );
  });

  it('keeps a closed set of known codes for the server', () => {
    expect(ApiErrorCode.safeParse('OOPS').success).toBe(false);
    expect(KNOWN_API_ERROR_CODES).toContain('NOT_READY');
  });

  it('publishes the code as an extensible string in JSON Schema', () => {
    const schema = z.toJSONSchema(ApiErrorEnvelope, { io: 'output' }) as unknown as {
      properties: { error: { properties: { code: Record<string, unknown> } } };
    };
    const code = schema.properties.error.properties.code;
    expect(code.type).toBe('string');
    expect(code.enum).toBeUndefined();
    expect(code['x-extensible-enum']).toEqual([...KNOWN_API_ERROR_CODES]);
    expect(String(code.description)).toMatch(/unknown/i);
  });
});
