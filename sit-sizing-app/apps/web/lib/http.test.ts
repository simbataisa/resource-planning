import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createApi } from './api';
import { ApiClientError, createHttp } from './http';

/** Fake transport: no network in unit tests. */
function adapter(
  status: number,
  data: unknown,
  seen: { headers?: Record<string, unknown> } = {},
): AxiosAdapter {
  return async (config) => {
    seen.headers = AxiosHeaders.from(config.headers).toJSON();
    const response = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400)
      throw new AxiosError('Request failed', String(status), config, null, response);
    return response;
  };
}

describe('Axios client', () => {
  it('adds a request id and the locale', async () => {
    const seen: { headers?: Record<string, unknown> } = {};
    const http = createHttp({ locale: () => 'vi' });
    http.defaults.adapter = adapter(200, { ok: true }, seen);
    await http.get('/x');
    expect(seen.headers?.['x-request-id']).toBeTruthy();
    expect(seen.headers?.['accept-language']).toBe('vi');
  });

  it('maps the error envelope to ApiClientError and calls the 401 hook', async () => {
    const onUnauthenticated = vi.fn();
    const http = createHttp({ onUnauthenticated });
    http.defaults.adapter = adapter(409, {
      error: {
        code: 'CONFLICT',
        message: 'Stale',
        details: [{ reason: 'STALE' }],
        requestId: 'r1',
      },
    });
    const err = await http.get('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).code).toBe('CONFLICT');
    expect((err as ApiClientError).reason).toBe('STALE');
    http.defaults.adapter = adapter(401, {
      error: { code: 'UNAUTHENTICATED', message: 'Sign in' },
    });
    await http.get('/x').catch(() => undefined);
    expect(onUnauthenticated).toHaveBeenCalledOnce();
  });

  it('parses responses with the contract and fails on drift', async () => {
    const http = createHttp();
    http.defaults.adapter = adapter(200, {
      id: 'u1',
      displayName: 'Synthetic',
      email: 'not-an-email',
      globalRole: 'USER',
      locale: 'en',
      memberships: [],
    });
    await expect(createApi(http).me()).rejects.toThrow();
  });
});
