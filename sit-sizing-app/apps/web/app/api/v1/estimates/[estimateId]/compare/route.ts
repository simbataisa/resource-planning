import { CompareQuery } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { EstimateParams } from '@/server/http/params';
import { compareVersions } from '@/server/services/review';

export const dynamic = 'force-dynamic';

export const GET = api<{ estimateId: string }>(async (request, { user, params }) => {
  const { estimateId } = EstimateParams.parse(params);
  const q = CompareQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await compareVersions(user, estimateId, q.a, q.b));
});
