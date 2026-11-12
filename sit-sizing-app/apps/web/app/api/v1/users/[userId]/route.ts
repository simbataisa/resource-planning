import { UserUpdate } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { UserParams } from '@/server/http/params';
import { readJson } from '@/server/http/parse';
import { setUserActive } from '@/server/services/admin';

export const dynamic = 'force-dynamic';

/** Deactivate or reactivate a user (Admin). */
export const PATCH = api<{ userId: string }>(async (request, { user, params, requestId }) =>
  ok(
    await setUserActive(
      user,
      UserParams.parse(params).userId,
      await readJson(request, UserUpdate),
      { requestId },
    ),
  ),
);
