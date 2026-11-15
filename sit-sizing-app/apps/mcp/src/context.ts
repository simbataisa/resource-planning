import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { Me } from '@sit/schemas';
import { z } from 'zod';
import type { ApiClient } from './api-client';
import { ApiCallError, AuthChallenge, toToolResult } from './errors';
import type { Logger } from './logger';
import type { RateLimiter } from './rate-limit';

export type Locale = 'en' | 'vi';

/** What every tool handler gets: one per MCP request, built from that request's token. */
export interface ToolContext {
  api: ApiClient;
  /** The user's locale from `GET /me`, read once per request; `'en'` on failure, except a 401, which rejects. */
  locale: () => Promise<Locale>;
  /** `GET /me`, fetched once per request and shared by `locale` and the `whoami` tool. */
  me: () => Promise<Me>;
  log: Logger;
  /** Stable key for the caller (token subject, or `dev:<user>`), used for the rate limit. */
  userKey: string;
  /** Per-user tool-call limit, shared by every request of this process. */
  limiter: RateLimiter;
}

export function createToolContext(init: Omit<ToolContext, 'locale' | 'me'>): ToolContext {
  let me: Promise<Me> | undefined;
  const getMe = () => (me ??= init.api.get('/me', Me));
  return {
    ...init,
    me: getMe,
    locale: () =>
      getMe().then(
        (m) => m.locale,
        (err) => {
          // A refused token must reach the caller as an auth challenge; anything else
          // (e.g. not provisioned yet) falls back to English and the tool decides.
          if (err instanceof ApiCallError && err.status === 401) throw err;
          return 'en' as const;
        },
      ),
  };
}

interface ToolConfig<I extends z.ZodObject | undefined, O extends z.ZodObject> {
  title: string;
  description: string;
  inputSchema?: I;
  outputSchema: O;
  annotations: ToolAnnotations;
}

type ToolArgs<I> = I extends z.ZodObject ? z.infer<I> : undefined;

/**
 * Registers a tool with the shared wrapper: the per-user rate limit, error mapping
 * (`toToolResult`), and one log line with the tool name, status and duration only.
 * Arguments are never logged. The result is returned as structured content and as JSON text.
 */
export function defineTool<I extends z.ZodObject | undefined, O extends z.ZodObject>(
  server: McpServer,
  ctx: ToolContext,
  name: string,
  config: ToolConfig<I, O>,
  handler: (args: ToolArgs<I>) => Promise<z.infer<O>>,
): void {
  const run = async (args: ToolArgs<I>): Promise<CallToolResult> => {
    const started = performance.now();
    let status = 'ok';
    try {
      const allowed = ctx.limiter.take(ctx.userKey);
      if (!allowed.ok) {
        status = 'rate_limited';
        return toToolResult(
          new ApiCallError({
            status: 429,
            code: 'RATE_LIMITED',
            message: 'Too many tool calls; wait before trying again.',
            retryAfter: allowed.retryAfter,
          }),
        );
      }
      // Every tool call reaches the API, so its token checks (refused `azp`, revoked
      // session, deactivated user) apply even to a tool that answers locally.
      await ctx.locale();
      const result = (await handler(args)) as Record<string, unknown>;
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    } catch (err) {
      status =
        err instanceof AuthChallenge || (err instanceof ApiCallError && err.status === 401)
          ? 'auth_challenge'
          : 'error';
      return toToolResult(err);
    } finally {
      ctx.log.info(
        { tool: name, status, durationMs: Math.round(performance.now() - started) },
        'tool call',
      );
    }
  };
  const callback = config.inputSchema
    ? (args: ToolArgs<I>) => run(args)
    : () => run(undefined as ToolArgs<I>);
  // A schema registered with `.meta({ id })` becomes a top-level `$ref` in JSON Schema,
  // which MCP refuses (tool output schemas must be `type: object`): re-wrap its shape.
  const outputSchema = z.object(config.outputSchema.shape);
  server.registerTool(name, { ...config, outputSchema }, callback as never);
}
