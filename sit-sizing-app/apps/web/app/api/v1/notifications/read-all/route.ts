import { api, ok } from '@/server/http/authed';
import { markAllRead } from '@/server/services/notifications';

export const dynamic = 'force-dynamic';

export const POST = api(async (_request, { user }) => ok(await markAllRead(user)));
