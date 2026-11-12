import type { z } from 'zod';
import { HttpError } from './route';

/** Reads a JSON body and validates it. Malformed JSON → 400; schema errors → 400 VALIDATION_FAILED. */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  let body: unknown;
  try {
    const text = await request.text();
    body = text.length ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'VALIDATION_FAILED', 'The request body is not valid JSON.');
  }
  return schema.parse(body);
}

/** Validates the query string. */
export function readQuery<S extends z.ZodType>(request: Request, schema: S): z.output<S> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return schema.parse(params);
}
