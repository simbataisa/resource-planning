import { getCurrentUser, type CurrentUser } from '../auth/current-user';
import { authedRoute, type AuthedContext } from './route';

export type ApiContext<P = Record<string, never>> = AuthedContext<P, CurrentUser>;

/** Route handler for a signed-in user (every /api/v1 route except health, ready). */
export function api<P = Record<string, never>>(
  handler: (request: Request, ctx: ApiContext<P>) => Promise<Response>,
) {
  return authedRoute<CurrentUser, P>(getCurrentUser, handler);
}

/** 200 JSON helper. */
export function ok(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
