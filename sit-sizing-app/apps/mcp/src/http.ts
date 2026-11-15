import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { JWTVerifyGetKey } from 'jose';
import { createApiClient } from './api-client';
import {
  bearerFromHeader,
  challengeHeader,
  MCP_PATH,
  METADATA_PATH,
  protectedResourceMetadata,
  verifyAccessToken,
} from './auth';
import { createToolContext } from './context';
import type { McpEnv } from './env';
import type { Logger } from './logger';
import type { RateLimiter } from './rate-limit';
import { createMcpServer } from './server';

/**
 * HTTP entry point on `node:http` (design spec 6.1, 6.2, 6.7):
 * - `POST /mcp`: MCP Streamable HTTP in stateless mode with JSON responses. Each request
 *   is checked for a bearer token, then gets its own MCP server built from that token.
 * - `GET /.well-known/oauth-protected-resource` (and its path-aware form `…/mcp`):
 *   RFC 9728 metadata naming Keycloak, with `${MCP_PUBLIC_URL}/mcp` as the resource.
 * - `GET /health` (always 200) and `GET /ready` (200 when the API is ready).
 *
 * The SDK's web-standard transport is used (the Node transport wraps the same class) so
 * the response can be replaced by a 401 challenge when the API refuses the token while a
 * tool runs: the SDK turns every tool exception into a tool error, so the challenge is
 * detected through the API client instead (Review Focus 2).
 */
export interface HttpDeps {
  env: McpEnv;
  log: Logger;
  limiter: RateLimiter;
  /** Used for every API call (tests pass a fake). */
  fetch?: typeof fetch;
  /** Token keys (tests pass a local key set); default: the realm's JWKS. */
  keys?: JWTVerifyGetKey;
}

const MAX_BODY_BYTES = 1024 * 1024;
const READY_TIMEOUT_MS = 3000;
const REQUEST_ID = /^[\w.-]{1,128}$/;

class BodyTooLarge extends Error {}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new BodyTooLarge();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Request headers for the SDK, without credentials (handlers can see request headers). */
function webHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined || name === 'authorization' || name === 'cookie') continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

export function createHttpServer(deps: HttpDeps): Server {
  const { env, log } = deps;
  const apiFetch = deps.fetch ?? fetch;

  function challenge(res: ServerResponse, error?: 'invalid_token') {
    sendJson(
      res,
      401,
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in to SIT Sizing to use this server.' } },
      { 'www-authenticate': challengeHeader(env, error) },
    );
  }

  async function ready(res: ServerResponse) {
    try {
      const r = await apiFetch(`${env.SIT_API_BASE_URL.replace(/\/+$/, '')}/api/v1/ready`, {
        signal: AbortSignal.timeout(READY_TIMEOUT_MS),
      });
      if (r.ok) return sendJson(res, 200, { status: 'ready' });
    } catch {
      // unreachable API: not ready
    }
    sendJson(res, 503, { status: 'not_ready' });
  }

  async function mcp(req: IncomingMessage, res: ServerResponse, requestId: string) {
    let token: string | undefined;
    let userKey: string;
    if (env.MCP_DEV_USER) {
      userKey = `dev:${env.MCP_DEV_USER}`;
    } else {
      const bearer = bearerFromHeader(req.headers.authorization);
      if (!bearer) return challenge(res);
      const verified = await verifyAccessToken(bearer, env, {
        log,
        ...(deps.keys ? { keys: deps.keys } : {}),
      });
      if (!verified) return challenge(res, 'invalid_token');
      token = bearer;
      userKey = verified.sub;
    }

    let raw: string;
    let parsedBody: unknown;
    try {
      raw = await readBody(req);
      parsedBody = JSON.parse(raw);
    } catch (err) {
      if (err instanceof BodyTooLarge)
        return sendJson(res, 413, {
          error: { code: 'VALIDATION_FAILED', message: 'Request body too large' },
        });
      return sendJson(res, 400, {
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error' },
        id: null,
      });
    }

    let unauthorized = false;
    const api = createApiClient({
      baseUrl: env.SIT_API_BASE_URL,
      requestId,
      ...(token ? { token } : { devUser: env.MCP_DEV_USER }),
      ...(deps.fetch ? { fetch: deps.fetch } : {}),
      onUnauthorized: () => {
        unauthorized = true;
      },
    });
    const ctx = createToolContext({
      api,
      log: log.child({ requestId, user: userKey }),
      userKey,
      limiter: deps.limiter,
    });
    const server = createMcpServer(ctx);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    let response: Response;
    try {
      await server.connect(transport);
      const request = new Request(`http://localhost${MCP_PATH}`, {
        method: 'POST',
        headers: webHeaders(req),
        body: raw,
      });
      response = await transport.handleRequest(request, { parsedBody });
    } finally {
      await server.close();
    }

    if (unauthorized) return challenge(res, 'invalid_token');
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  }

  async function route(req: IncomingMessage, res: ServerResponse) {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('x-request-id', requestId);
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;

    if (path === MCP_PATH) {
      if (req.method !== 'POST')
        return sendJson(
          res,
          405,
          { error: { code: 'NOT_FOUND', message: 'Use POST' } },
          { allow: 'POST' },
        );
      return mcp(req, res, requestId);
    }
    if (req.method === 'GET' && path === '/health') return sendJson(res, 200, { status: 'ok' });
    if (req.method === 'GET' && path === '/ready') return ready(res);
    if (req.method === 'GET' && (path === METADATA_PATH || path === METADATA_PATH + MCP_PATH))
      return sendJson(res, 200, protectedResourceMetadata(env));
    sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  }

  return createServer((req, res) => {
    const started = performance.now();
    res.on('finish', () => {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      log.info(
        {
          method: req.method,
          path,
          status: res.statusCode,
          durationMs: Math.round(performance.now() - started),
        },
        'request',
      );
    });
    route(req, res).catch((err: unknown) => {
      log.error({ err: { name: (err as Error | null)?.name ?? 'Error' } }, 'request failed');
      if (!res.headersSent)
        sendJson(res, 500, { error: { code: 'INTERNAL', message: 'Internal error' } });
      else res.end();
    });
  });
}
