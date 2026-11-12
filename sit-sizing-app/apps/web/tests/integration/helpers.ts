import { DEV_USER_HEADER } from '@/server/auth/current-user';
import { db } from '@/server/db';

export type Who = 'dev-admin' | 'dev-lead' | 'dev-estimator' | 'dev-viewer' | 'dev-outsider' | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- route handlers differ in their params type
type Handler = (request: Request, ctx: any) => Promise<Response>;

/** Calls a route handler as a given seeded user (null = not signed in). */
export async function call(
  handler: Handler,
  opts: {
    who: Who;
    method?: string;
    path?: string;
    body?: unknown;
    params?: Record<string, string>;
  },
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.who) headers[DEV_USER_HEADER] = opts.who;
  const request = new Request(`http://localhost:3000/api/v1${opts.path ?? '/'}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await handler(request, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test convenience
  const json: any = text ? JSON.parse(text) : null;
  return { status: res.status, json };
}

export async function seeded() {
  const demo = await db().project.findUniqueOrThrow({ where: { key: 'DEMO' } });
  const other = await db().project.findUniqueOrThrow({ where: { key: 'OTHER' } });
  const example = await db().estimate.findFirstOrThrow({
    where: { projectId: demo.id, name: 'Example estimate' },
  });
  const profile = await db().assumptionProfile.findFirstOrThrow({
    where: { scope: 'GLOBAL', name: 'Default (uncalibrated)' },
  });
  return { demo, other, example, profile };
}
