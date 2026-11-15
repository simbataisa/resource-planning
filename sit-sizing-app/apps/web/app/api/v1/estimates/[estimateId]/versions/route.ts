import { VersionSave } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { EstimateParams, lockTokenOf } from '@/server/http/params';
import { readJson } from '@/server/http/parse';
import { saveVersion } from '@/server/services/versions';

export const dynamic = 'force-dynamic';

/** Freeze the draft as a saved version. */
export const POST = api<{ estimateId: string }>(async (request, { user, params, requestId }) =>
  ok(
    await saveVersion(
      user,
      EstimateParams.parse(params).estimateId,
      await readJson(request, VersionSave),
      { requestId },
      lockTokenOf(request),
    ),
    201,
  ),
);
