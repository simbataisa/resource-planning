import { route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

/** Liveness: the process is up. No dependencies are checked here (design 12.6). */
export const GET = route(async () =>
  Response.json({
    status: 'ok',
    version: process.env.APP_VERSION ?? '0.0.0-dev',
    uptimeSeconds: Math.round(process.uptime()),
  }),
);
