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
  /** The user's locale from `GET /me`, read once per request on first use; `'en'` on failure. */
  locale: () => Promise<Locale>;
  log: Logger;
  /** Stable key for the caller (token subject, or `dev:<user>`), used for the rate limit. */
  userKey: string;
  /** Per-user tool-call limit, shared by every request of this process. */
  limiter: RateLimiter;
}

export function createToolContext(init: Omit<ToolContext, 'locale'>): ToolContext {
  let locale: Promise<Locale> | undefined;
  return {
    ...init,
    locale: () =>
      (locale ??= init.api.get('/me', Me).then(
        (me) => me.locale,
        () => 'en' as const,
      )),
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
