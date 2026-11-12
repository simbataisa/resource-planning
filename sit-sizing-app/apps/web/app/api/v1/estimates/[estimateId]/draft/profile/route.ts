import { ProfileApply } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { EstimateParams } from '@/server/http/params';
import { readJson } from '@/server/http/parse';
import { applyProfile } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

/** Replace the draft's assumptions with a published profile (P-01). Lock holder only. */
export const POST = api<{ estimateId: string }>(async (request, { user, params, requestId }) =>
  ok(
    await applyProfile(
      user,
      EstimateParams.parse(params).estimateId,
      await readJson(request, ProfileApply),
      { requestId },
    ),
  ),
);
