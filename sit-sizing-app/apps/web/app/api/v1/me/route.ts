import { MeUpdate } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { readJson } from '@/server/http/parse';
import { getMe, updateMe } from '@/server/services/me';

export const dynamic = 'force-dynamic';

export const GET = api(async (_request, { user }) => ok(await getMe(user)));

export const PATCH = api(async (request, { user }) =>
  ok(await updateMe(user, await readJson(request, MeUpdate))),
);
