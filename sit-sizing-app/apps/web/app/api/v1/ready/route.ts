import { db } from '@/server/db';
import { errorResponse, route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 2000;

/** Readiness: the database answers a query (design 12.6). Keycloak discovery is added in step 1.3. */
export const GET = route(async (_request, { requestId }) => {
  const started = performance.now();
  let database: { ok: boolean; latencyMs: number; reason?: string };
  try {
    await Promise.race([
      db().$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)),
    ]);
    database = { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    const reason = err instanceof Error && err.message === 'TIMEOUT' ? 'TIMEOUT' : 'UNREACHABLE';
    database = { ok: false, latencyMs: Math.round(performance.now() - started), reason };
  }
  const checks = { database };
  if (!database.ok)
    return errorResponse(503, 'NOT_READY', 'A dependency is not reachable.', requestId, [checks]);
  return Response.json({ status: 'ready', checks });
});
