import { api, ok } from '@/server/http/authed';
import { ProfileParams } from '@/server/http/params';
import { changeProfileStatus } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

export const POST = api<{ profileId: string }>(async (_request, { user, params, requestId }) =>
  ok(
    await changeProfileStatus(user, ProfileParams.parse(params).profileId, 'retire', { requestId }),
  ),
);
