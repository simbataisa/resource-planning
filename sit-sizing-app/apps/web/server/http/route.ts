import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import type { ApiError, KnownApiErrorCode } from '@sit/schemas';
import { isBearerRequest } from '../auth/bearer-header';
import { logger as rootLogger } from '../logger';

/** The server emits only known codes; clients accept any (ADR-0018). */
type ApiErrorCode = KnownApiErrorCode;

/** Throw from a handler or service to return a typed error envelope. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: unknown[] | undefined;
  /** Extra response headers, e.g. Retry-After on 429. */
  readonly headers: Record<string, string> | undefined;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: unknown[],
    headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }
}

export interface RouteContext<P> {
  requestId: string;
  log: Logger;
  params: P;
}

type Handler<P> = (request: Request, ctx: RouteContext<P>) => Promise<Response>;

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId: string,
  details?: unknown[],
): Response {
  const body: ApiError = { error: { code, message, requestId, ...(details ? { details } : {}) } };
  return Response.json(body, { status });
}

/** Prisma known request errors carry a string code; mapped without importing Prisma here. */
function prismaCode(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
}

function toErrorResponse(err: unknown, requestId: string, log: Logger): Response {
  const pc = prismaCode(err);
  if (pc === 'P2002') return errorResponse(409, 'CONFLICT', 'That already exists.', requestId);
  if (pc === 'P2025') return errorResponse(404, 'NOT_FOUND', 'Not found.', requestId);
  if (err instanceof HttpError) {
    const res = errorResponse(err.status, err.code, err.message, requestId, err.details);
    for (const [k, v] of Object.entries(err.headers ?? {})) res.headers.set(k, v);
    return res;
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path, message: i.message }));
    return errorResponse(400, 'VALIDATION_FAILED', 'The request is not valid.', requestId, details);
  }
  log.error({ err }, 'unhandled error');
  return errorResponse(
    500,
    'INTERNAL',
    'Something went wrong. Quote the request ID when reporting it.',
    requestId,
  );
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence (design 11, threat T-16): SameSite cookies plus an Origin check on
 * state-changing requests. Browsers always send Origin on these; non-browser
 * clients without Origin are allowed (they cannot ride a user's cookies).
 */
export function assertSameOrigin(request: Request): void {
  if (!UNSAFE.has(request.method)) return;
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    new URL(request.url).host;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'FORBIDDEN', 'Cross-site request blocked.');
  }
  if (originHost !== host) throw new HttpError(403, 'FORBIDDEN', 'Cross-site request blocked.');
}

/**
 * Wraps every route handler (design 9.1):
 * request ID → child logger → handler → error envelope → access log line.
 * Step 1.3 adds authenticate/authorise here; step 1.2 adds Zod parsing helpers.
 */
export function route<P = Record<string, never>>(handler: Handler<P>) {
  return async (request: Request, context?: { params?: Promise<P> }): Promise<Response> => {
    const requestId = request.headers.get('x-request-id') ?? randomUUID();
    const { pathname } = new URL(request.url);
    const log = rootLogger.child({ requestId, method: request.method, route: pathname });
    const started = performance.now();

    let response: Response;
    try {
      assertSameOrigin(request);
      const params = context?.params ? await context.params : ({} as P);
      response = await handler(request, { requestId, log, params });
    } catch (err) {
      response = toErrorResponse(err, requestId, log);
    }

    response.headers.set('x-request-id', requestId);
    response.headers.set('cache-control', response.headers.get('cache-control') ?? 'no-store');
    log.info(
      { status: response.status, durationMs: Math.round(performance.now() - started) },
      'request completed',
    );
    return response;
  };
}

/** Context for handlers that need a signed-in user. */
export interface AuthedContext<P, U> extends RouteContext<P> {
  user: U;
}

/**
 * route() + authentication: 401 when nobody is signed in. Authorisation happens in
 * the service layer with lib/rbac.ts, because it needs the resource's project.
 * A refused bearer token also gets `WWW-Authenticate: Bearer error="invalid_token"`
 * (RFC 6750), so a client knows to get a new token (ADR-0016).
 */
export function authedRoute<U, P = Record<string, never>>(
  getUser: (request: Request) => Promise<U | null>,
  handler: (request: Request, ctx: AuthedContext<P, U>) => Promise<Response>,
) {
  return route<P>(async (request, ctx) => {
    const user = await getUser(request);
    if (!user) {
      throw new HttpError(
        401,
        'UNAUTHENTICATED',
        'Sign in to continue.',
        undefined,
        isBearerRequest(request)
          ? { 'www-authenticate': 'Bearer error="invalid_token"' }
          : undefined,
      );
    }
    return handler(request, { ...ctx, user });
  });
}
