import { LockRequest } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { EstimateParams, lockTokenOf } from '@/server/http/params';
import { readJson } from '@/server/http/parse';
import { lockDraft, unlockDraft } from '@/server/services/versions';

export const dynamic = 'force-dynamic';

/**
 * Take, renew (heartbeat, with X-Lock-Token) or take over (`takeover: true`) the edit lock.
 * A new token is returned when the lock is taken or taken over.
 */
export const POST = api<{ estimateId: string }>(async (request, { user, params, requestId }) =>
  ok(
    await lockDraft(
      user,
      EstimateParams.parse(params).estimateId,
      await readJson(request, LockRequest),
      { requestId },
      lockTokenOf(request),
    ),
  ),
);

export const DELETE = api<{ estimateId: string }>(async (request, { user, params }) => {
  await unlockDraft(user, EstimateParams.parse(params).estimateId, lockTokenOf(request));
  return new Response(null, { status: 204 });
});
