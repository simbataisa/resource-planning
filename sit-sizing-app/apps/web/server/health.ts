import { Socket } from 'node:net';

export interface CheckResult {
  ok: boolean;
  latencyMs: number;
  /** Short reason code only (e.g. ECONNREFUSED, TIMEOUT); never hostnames or credentials. */
  reason?: string;
}

/**
 * TCP reachability of a service URL. Step 1.0 uses this for the database;
 * step 1.2 replaces it with `SELECT 1` through Prisma, step 1.3 adds Keycloak discovery.
 */
export function checkTcp(
  serviceUrl: string,
  timeoutMs = 1000,
  defaultPort = 5432,
): Promise<CheckResult> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  let host: string;
  let port: number;
  try {
    const u = new URL(serviceUrl);
    host = u.hostname;
    port = u.port ? Number(u.port) : defaultPort;
  } catch {
    return Promise.resolve({ ok: false, latencyMs: 0, reason: 'INVALID_URL' });
  }

  return new Promise((resolve) => {
    const socket = new Socket();
    const done = (result: CheckResult) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done({ ok: true, latencyMs: elapsed() }));
    socket.once('timeout', () => done({ ok: false, latencyMs: elapsed(), reason: 'TIMEOUT' }));
    socket.once('error', (err: NodeJS.ErrnoException) =>
      done({ ok: false, latencyMs: elapsed(), reason: err.code ?? 'ERROR' }),
    );
    socket.connect(port, host);
  });
}
