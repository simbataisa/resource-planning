import { api, ok } from '@/server/http/authed';
import { getMe } from '@/server/services/me';

export const dynamic = 'force-dynamic';

export const GET = api(async (_request, { user }) => ok(await getMe(user)));
