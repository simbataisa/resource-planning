import axios, { AxiosError, type AxiosInstance } from 'axios';
import { ApiErrorEnvelope, type ApiError } from '@sit/schemas';

/**
 * The one Axios instance (design 9.3). Components never import this directly:
 * they use the query hooks in lib/query, which call the typed modules in lib/api.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiError['error']['code'] | 'NETWORK';
  readonly details: unknown[] | undefined;
  readonly requestId: string | undefined;

  constructor(status: number, body: ApiError | null, fallback: string) {
    super(body?.error.message ?? fallback);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body?.error.code ?? 'NETWORK';
    this.details = body?.error.details;
    this.requestId = body?.error.requestId;
  }

  /** The `reason` the API puts in details for 409s (STALE, LOCK_REQUIRED, HELD_BY_OTHER, …). */
  get reason(): string | undefined {
    const first = this.details?.[0] as { reason?: unknown } | undefined;
    return typeof first?.reason === 'string' ? first.reason : undefined;
  }
}

export interface HttpOptions {
  baseURL?: string;
  locale?: () => string;
  onUnauthenticated?: () => void;
}

const newRequestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export function createHttp(opts: HttpOptions = {}): AxiosInstance {
  const http = axios.create({
    baseURL: opts.baseURL ?? '/api/v1',
    withCredentials: true,
    timeout: 15_000,
    headers: { 'content-type': 'application/json' },
  });

  http.interceptors.request.use((config) => {
    config.headers.set('x-request-id', newRequestId());
    const locale = opts.locale?.();
    if (locale) config.headers.set('accept-language', locale);
    return config;
  });

  http.interceptors.response.use(
    (res) => res,
    (err: unknown) => {
      if (err instanceof AxiosError) {
        const status = err.response?.status ?? 0;
        const parsed = ApiErrorEnvelope.safeParse(err.response?.data);
        if (status === 401) opts.onUnauthenticated?.();
        return Promise.reject(
          new ApiClientError(status, parsed.success ? parsed.data : null, err.message),
        );
      }
      return Promise.reject(err);
    },
  );
  return http;
}

/** Browser default: on 401, go to Keycloak sign-in and come back to this page. */
export const http = createHttp({
  locale: () => (typeof document !== 'undefined' ? document.documentElement.lang || 'en' : 'en'),
  onUnauthenticated: () => {
    if (typeof window !== 'undefined')
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Axios interceptor runs outside React
      window.location.assign(
        `/api/auth/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
  },
});
