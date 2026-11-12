import { ProfileCreate, ProfileListQuery } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { readJson, readQuery } from '@/server/http/parse';
import { createProfile, listProfiles } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

export const GET = api(async (request, { user }) =>
  ok(await listProfiles(user, readQuery(request, ProfileListQuery))),
);

/** Create a draft profile, blank (engine defaults) or cloned (P-01). */
export const POST = api(async (request, { user, requestId }) =>
  ok(await createProfile(user, await readJson(request, ProfileCreate), { requestId }), 201),
);
