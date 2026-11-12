import { api, ok } from '@/server/http/authed';
import { ProfileParams } from '@/server/http/params';
import { getProfile } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

export const GET = api<{ profileId: string }>(async (_request, { user, params }) =>
  ok(await getProfile(user, ProfileParams.parse(params).profileId)),
);
