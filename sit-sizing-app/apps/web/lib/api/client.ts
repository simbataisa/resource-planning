import type { AxiosInstance } from 'axios';
import type { z } from 'zod';

/**
 * Typed call helper: every response is parsed with its Zod schema, so a contract drift
 * fails loudly in tests and in the browser console (design 13, L4 contract).
 */
export async function getParsed<S extends z.ZodType>(
  http: AxiosInstance,
  url: string,
  schema: S,
  params?: object,
): Promise<z.output<S>> {
  const res = await http.get(url, { params });
  return schema.parse(res.data);
}

export async function sendParsed<S extends z.ZodType>(
  http: AxiosInstance,
  method: 'post' | 'put' | 'patch',
  url: string,
  body: unknown,
  schema: S,
  headers?: Record<string, string>,
): Promise<z.output<S>> {
  const res = await http.request({ method, url, data: body, headers });
  return schema.parse(res.data);
}
