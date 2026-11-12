import { ProfileListQuery } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { readQuery } from '@/server/http/parse';
import { listProfiles } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

export const GET = api(async (request, { user }) =>
  ok(await listProfiles(user, readQuery(request, ProfileListQuery))),
);
