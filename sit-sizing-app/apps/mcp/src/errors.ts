import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { PathError } from './merge';

/** A non-2xx answer from the SIT Sizing API, parsed from its error envelope (design 9.1). */
export class ApiCallError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown[] | undefined;
  readonly retryAfter: number | undefined;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: unknown[];
    retryAfter?: number;
  }) {
    super(init.message);
    this.name = 'ApiCallError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.retryAfter = init.retryAfter;
  }
}

/**
 * The caller's token is missing, expired or refused. The HTTP layer answers 401 with
 * `WWW-Authenticate` so the MCP client signs in again (Review Focus 2).
 */
export class AuthChallenge extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'AuthChallenge';
  }
}

/** Each Zod issue as `{ path, message }`, the path dotted (`inputs.features.0.count`). */
export function zodIssues(error: z.core.$ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message }));
}

/** A validation error for one argument, reported like a schema error (`VALIDATION_FAILED`). */
export function invalidInput(path: string, message: string): z.ZodError {
  return new z.ZodError([{ code: 'custom', path: path.split('.'), message, input: undefined }]);
}

/** The draft is open in the editor (the user's own lock, held by another session). */
export const EDITOR_OPEN = 'EDITOR_OPEN: close the draft in the editor first';

/** True when the API error's details carry `{ reason }` (e.g. `LOCKED_ELSEWHERE`, `RACE`). */
export function hasReason(err: ApiCallError, reason: string): boolean {
  return (err.details ?? []).some(
    (d) => typeof d === 'object' && d !== null && (d as { reason?: unknown }).reason === reason,
  );
}

function toolError(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

/**
 * Turns an error from a tool handler into an MCP tool error the assistant can explain:
 * `"<CODE>: <message>"` and the details as JSON. A 401 is rethrown as `AuthChallenge`;
 * an unexpected error never shows its own message (it can hold hosts or internals).
 */
export function toToolResult(err: unknown): CallToolResult {
  if (err instanceof AuthChallenge) throw err;
  if (err instanceof ApiCallError) {
    if (err.status === 401) throw new AuthChallenge();
    if (hasReason(err, 'LOCKED_ELSEWHERE')) return toolError(EDITOR_OPEN);
    let text = `${err.code}: ${err.message}`;
    if (err.retryAfter !== undefined) text += ` Retry after ${err.retryAfter} seconds.`;
    if (err.details?.length) text += `\n${JSON.stringify(err.details)}`;
    return toolError(text);
  }
  if (err instanceof PathError) {
    return toolError(
      `VALIDATION_FAILED: Invalid input\n${JSON.stringify([{ path: err.path, message: err.message }])}`,
    );
  }
  if (err instanceof z.core.$ZodError) {
    return toolError(`VALIDATION_FAILED: Invalid input\n${JSON.stringify(zodIssues(err))}`);
  }
  return toolError('INTERNAL: The SIT Sizing service could not complete the request.');
}
