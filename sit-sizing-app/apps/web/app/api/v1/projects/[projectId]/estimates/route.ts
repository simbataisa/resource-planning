import { EstimateCreate, PageQuery } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { ProjectParams } from '@/server/http/params';
import { readJson, readQuery } from '@/server/http/parse';
import { createEstimate, listEstimates } from '@/server/services/estimates';

export const dynamic = 'force-dynamic';

export const GET = api<{ projectId: string }>(async (request, { user, params }) =>
  ok(
    await listEstimates(user, ProjectParams.parse(params).projectId, readQuery(request, PageQuery)),
  ),
);

export const POST = api<{ projectId: string }>(async (request, { user, params, requestId }) =>
  ok(
    await createEstimate(
      user,
      ProjectParams.parse(params).projectId,
      await readJson(request, EstimateCreate),
      { requestId },
    ),
    201,
  ),
);
