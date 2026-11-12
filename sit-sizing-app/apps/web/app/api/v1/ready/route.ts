import { rewriteToInternal } from '@/server/auth/oidc';
import { db } from '@/server/db';
import { getEnv } from '@/server/env';
import { errorResponse, route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 2000;
type Check = { ok: boolean; latencyMs: number; reason?: string };

async function timed(fn: () => Promise<unknown>): Promise<Check> {
  const started = performance.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)),
    ]);
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    const reason = err instanceof Error && err.message === 'TIMEOUT' ? 'TIMEOUT' : 'UNREACHABLE';
    return { ok: false, latencyMs: Math.round(performance.now() - started), reason };
  }
}

/** Readiness: the database answers and, when sign-in is configured, Keycloak discovery responds (design 12.6). */
export const GET = route(async (_request, { requestId }) => {
  const env = getEnv();
  const checks: Record<string, Check> = { database: await timed(() => db().$queryRaw`SELECT 1`) };
  if (env.OIDC_ISSUER) {
    const url = rewriteToInternal(
      `${env.OIDC_ISSUER}/.well-known/openid-configuration`,
      env.OIDC_ISSUER,
      env.OIDC_INTERNAL_URL,
    );
    checks.identityProvider = await timed(async () => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
  }
  if (Object.values(checks).some((c) => !c.ok)) {
    return errorResponse(503, 'NOT_READY', 'A dependency is not reachable.', requestId, [checks]);
  }
  return Response.json({ status: 'ready', checks });
});
