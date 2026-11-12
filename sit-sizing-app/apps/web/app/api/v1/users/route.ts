import { UserListQuery } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { readQuery } from '@/server/http/parse';
import { listUsers } from '@/server/services/admin';

export const dynamic = 'force-dynamic';

export const GET = api(async (request, { user }) =>
  ok(await listUsers(user, readQuery(request, UserListQuery))),
);
