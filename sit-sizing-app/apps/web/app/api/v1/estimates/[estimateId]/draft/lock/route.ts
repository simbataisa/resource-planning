import { LockRequest } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { EstimateParams } from '@/server/http/params';
import { readJson } from '@/server/http/parse';
import { lockDraft, unlockDraft } from '@/server/services/versions';

export const dynamic = 'force-dynamic';

/** Take, renew (heartbeat) or — QE Lead with `takeover: true` — take over the edit lock. */
export const POST = api<{ estimateId: string }>(async (request, { user, params, requestId }) =>
  ok(
    await lockDraft(
      user,
      EstimateParams.parse(params).estimateId,
      await readJson(request, LockRequest),
      { requestId },
    ),
  ),
);

export const DELETE = api<{ estimateId: string }>(async (_request, { user, params }) => {
  await unlockDraft(user, EstimateParams.parse(params).estimateId);
  return new Response(null, { status: 204 });
});
