import { getCurrentUser, type CurrentUser } from '../auth/current-user';
import { getEnv } from '../env';
import { createRateLimiter } from './rate-limit';
import { authedRoute, HttpError, type AuthedContext } from './route';

export type ApiContext<P = Record<string, never>> = AuthedContext<P, CurrentUser>;

let limiter: ReturnType<typeof createRateLimiter> | undefined;
const rateLimit = (userId: string) => {
  limiter ??= createRateLimiter(getEnv().RATE_LIMIT_PER_MINUTE);
  return limiter(userId);
};

/**
 * Route handler for a signed-in user (every /api/v1 route except health, ready).
 * Each user has a per-minute request budget (threat model T-11); over it the API answers
 * 429 RATE_LIMITED with Retry-After.
 */
export function api<P = Record<string, never>>(
  handler: (request: Request, ctx: ApiContext<P>) => Promise<Response>,
) {
  return authedRoute<CurrentUser, P>(getCurrentUser, async (request, ctx) => {
    const r = rateLimit(ctx.user.id);
    if (!r.allowed) {
      throw new HttpError(
        429,
        'RATE_LIMITED',
        'Too many requests. Wait a moment and try again.',
        [{ retryAfterSeconds: r.retryAfter }],
        { 'retry-after': String(r.retryAfter) },
      );
    }
    return handler(request, ctx);
  });
}

/** 200 JSON helper. */
export function ok(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
