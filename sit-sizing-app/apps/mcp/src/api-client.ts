import { ApiErrorEnvelope } from '@sit/schemas';
import type { ZodType } from 'zod';
import { ApiCallError, zodIssues } from './errors';

/**
 * Typed client for the SIT Sizing API (`/api/v1`). It forwards the caller's own bearer
 * token (or, locally, `x-dev-user`) and the request ID, parses every 2xx body with the
 * given schema, and turns every other answer into `ApiCallError`.
 */
export type Query = Record<string, string | number | boolean | undefined>;

export interface ApiClient {
  get<T>(path: string, schema: ZodType<T>, query?: Query): Promise<T>;
  post<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T>;
  patch<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T>;
  del(path: string, opts?: CallOptions): Promise<void>;
}

export interface CallOptions {
  /**
   * Best-effort call (the lock release after a write): a 401 still rejects, but does not
   * call `onUnauthorized`, so it cannot turn a completed write into an auth challenge.
   */
  noChallenge?: boolean;
}

export interface ApiClientOptions {
  baseUrl: string;
  token?: string;
  devUser?: string;
  fetch?: typeof fetch;
  requestId: string;
  /** Called on every 401, so the HTTP layer can answer with an auth challenge. */
  onUnauthorized?: () => void;
}

/** Error code for an answer without a readable envelope. */
function codeForStatus(status: number): string {
  if (status === 400 || status === 422) return 'VALIDATION_FAILED';
  const codes: Record<number, string> = {
    401: 'UNAUTHENTICATED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    429: 'RATE_LIMITED',
    503: 'NOT_READY',
  };
  return codes[status] ?? 'INTERNAL';
}

function retryAfter(res: Response): number | undefined {
  const seconds = Number(res.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

async function readJson(res: Response): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: (await res.json()) as unknown };
  } catch {
    return { ok: false };
  }
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const doFetch = opts.fetch ?? fetch;
  const root = `${opts.baseUrl.replace(/\/+$/, '')}/api/v1`;

  async function send(
    method: string,
    path: string,
    body?: unknown,
    query?: Query,
    callOpts: CallOptions = {},
  ): Promise<Response> {
    const url = new URL(root + path);
    for (const [k, v] of Object.entries(query ?? {}))
      if (v !== undefined) url.searchParams.set(k, String(v));
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-request-id': opts.requestId,
    };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    else if (opts.devUser) headers['x-dev-user'] = opts.devUser;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await doFetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.ok) return res;

    if (res.status === 401 && !callOpts.noChallenge) opts.onUnauthorized?.();
    const json = await readJson(res);
    const envelope = json.ok ? ApiErrorEnvelope.safeParse(json.value) : undefined;
    const ra = retryAfter(res);
    if (envelope?.success) {
      const { code, message, details } = envelope.data.error;
      throw new ApiCallError({
        status: res.status,
        code,
        message,
        details,
        ...(ra ? { retryAfter: ra } : {}),
      });
    }
    throw new ApiCallError({
      status: res.status,
      code: codeForStatus(res.status),
      message: `The API answered HTTP ${res.status}`,
      ...(ra ? { retryAfter: ra } : {}),
    });
  }

  async function parse<T>(res: Response, schema: ZodType<T>): Promise<T> {
    const json = await readJson(res);
    const parsed = json.ok ? schema.safeParse(json.value) : undefined;
    if (parsed?.success) return parsed.data;
    throw new ApiCallError({
      status: 502,
      code: 'INTERNAL',
      message: 'The API answered with an unexpected body',
      ...(parsed ? { details: zodIssues(parsed.error) } : {}),
    });
  }

  return {
    get: async (path, schema, query) => parse(await send('GET', path, undefined, query), schema),
    post: async (path, body, schema) => parse(await send('POST', path, body), schema),
    patch: async (path, body, schema) => parse(await send('PATCH', path, body), schema),
    del: async (path, callOpts) => {
      await send('DELETE', path, undefined, undefined, callOpts);
    },
  };
}
