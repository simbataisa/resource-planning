import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiCallError, AuthChallenge, toToolResult } from './errors';

const text = (r: { content: Array<{ type: string; text?: string }> }) => r.content[0]?.text ?? '';

describe('toToolResult', () => {
  it('maps a 404 envelope to a tool error starting "NOT_FOUND:"', () => {
    const r = toToolResult(
      new ApiCallError({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Estimate not found',
        details: [{ id: 'e1' }],
      }),
    );
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/^NOT_FOUND: Estimate not found/);
    expect(text(r)).toContain('[{"id":"e1"}]');
  });

  it('turns a 401 into an auth challenge, not a tool error', () => {
    expect(() =>
      toToolResult(new ApiCallError({ status: 401, code: 'UNAUTHENTICATED', message: 'Sign in' })),
    ).toThrow(AuthChallenge);
    expect(() => toToolResult(new AuthChallenge())).toThrow(AuthChallenge);
  });

  it('keeps a 403 NOT_PROVISIONED as a tool error and says when to retry a 429', () => {
    const np = toToolResult(
      new ApiCallError({
        status: 403,
        code: 'NOT_PROVISIONED',
        message: 'Sign in to SIT Sizing once first',
      }),
    );
    expect(np.isError).toBe(true);
    expect(text(np)).toBe('NOT_PROVISIONED: Sign in to SIT Sizing once first');
    const rl = toToolResult(
      new ApiCallError({
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        retryAfter: 12,
      }),
    );
    expect(text(rl)).toContain('Retry after 12 seconds.');
  });

  it('names the path of each Zod issue', () => {
    const schema = z.object({
      inputs: z.object({ count: z.number().min(0) }),
      tags: z.array(z.string()),
    });
    const parsed = schema.safeParse({ inputs: { count: -1 }, tags: [1] });
    expect(parsed.success).toBe(false);
    const r = toToolResult(parsed.error);
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/^VALIDATION_FAILED: /);
    expect(text(r)).toContain('"path":"inputs.count"');
    expect(text(r)).toContain('"path":"tags.0"');
  });

  it('hides the message of an unexpected error', () => {
    const r = toToolResult(new Error('connect ECONNREFUSED 10.0.0.1:3000 secret-ish'));
    expect(text(r)).toBe('INTERNAL: The SIT Sizing service could not complete the request.');
    expect(toToolResult('weird').isError).toBe(true);
  });
});
