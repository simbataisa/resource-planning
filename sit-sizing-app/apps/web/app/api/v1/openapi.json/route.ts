import { api } from '@/server/http/authed';
import { openApiText } from '@/server/openapi/build';

export const dynamic = 'force-dynamic';

let cached: string | undefined;

/** The OpenAPI document (design 9.4). Same content as the committed docs/api/openapi.json. */
export const GET = api(async () => {
  cached ??= openApiText();
  return new Response(cached, { headers: { 'content-type': 'application/json; charset=utf-8' } });
});
