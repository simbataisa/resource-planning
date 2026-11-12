import { ActualsCreate } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { VersionParams } from '@/server/http/params';
import { readJson } from '@/server/http/parse';
import { listActuals, recordActuals } from '@/server/services/actuals';

export const dynamic = 'force-dynamic';

/** SIT cycles recorded against this version, with their variance (P-02). */
export const GET = api<{ estimateId: string; number: string }>(
  async (_request, { user, params }) => {
    const p = VersionParams.parse(params);
    return ok(await listActuals(user, p.estimateId, p.number));
  },
);

export const POST = api<{ estimateId: string; number: string }>(
  async (request, { user, params, requestId }) => {
    const p = VersionParams.parse(params);
    const body = await readJson(request, ActualsCreate);
    return ok(await recordActuals(user, p.estimateId, p.number, body, { requestId }), 201);
  },
);
