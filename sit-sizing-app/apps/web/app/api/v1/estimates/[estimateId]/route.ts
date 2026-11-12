import { api, ok } from '@/server/http/authed';
import { EstimateParams } from '@/server/http/params';
import { getEstimate } from '@/server/services/estimates';

export const dynamic = 'force-dynamic';

export const GET = api<{ estimateId: string }>(async (_request, { user, params }) =>
  ok(await getEstimate(user, EstimateParams.parse(params).estimateId)),
);
