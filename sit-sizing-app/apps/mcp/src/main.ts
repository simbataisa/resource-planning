import type { Server } from 'node:http';
import { pathToFileURL } from 'node:url';
import { parseEnv } from './env';
import { createHttpServer } from './http';
import { createLogger, type Logger } from './logger';
import { createRateLimiter } from './rate-limit';

/** Validates the environment and starts listening on `MCP_PORT`. */
export async function start(
  source: NodeJS.ProcessEnv = process.env,
  opts: { log?: Logger; host?: string } = {},
): Promise<Server> {
  const env = parseEnv(source);
  const log = opts.log ?? createLogger(env.LOG_LEVEL);
  const server = createHttpServer({
    env,
    log,
    limiter: createRateLimiter({ limit: env.MCP_RATE_LIMIT_PER_MINUTE }),
  });
  await new Promise<void>((resolve) => server.listen(env.MCP_PORT, opts.host, resolve));
  const address = server.address();
  log.info(
    {
      port: typeof address === 'object' && address ? address.port : env.MCP_PORT,
      devMode: Boolean(env.MCP_DEV_USER),
    },
    'mcp server listening',
  );
  return server;
}

/* v8 ignore start -- process entry point, exercised by `pnpm --filter @sit/mcp start` */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().then(
    (server) => {
      for (const signal of ['SIGTERM', 'SIGINT'] as const) {
        process.once(signal, () => server.close(() => process.exit(0)));
      }
    },
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : 'MCP server failed to start');
      process.exit(1);
    },
  );
}
/* v8 ignore stop */
