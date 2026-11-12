import { ProfileUpdate } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { ProfileParams } from '@/server/http/params';
import { readJson } from '@/server/http/parse';
import { getProfile, updateProfile } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

export const GET = api<{ profileId: string }>(async (_request, { user, params }) =>
  ok(await getProfile(user, ProfileParams.parse(params).profileId)),
);

/** Change a draft profile's name, values or calibration notes. */
export const PATCH = api<{ profileId: string }>(async (request, { user, params, requestId }) =>
  ok(
    await updateProfile(
      user,
      ProfileParams.parse(params).profileId,
      await readJson(request, ProfileUpdate),
      { requestId },
    ),
  ),
);
