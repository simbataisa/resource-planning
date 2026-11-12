import { api, ok } from '@/server/http/authed';
import { listNotifications } from '@/server/services/notifications';

export const dynamic = 'force-dynamic';

/** My in-app notifications (N-01). */
export const GET = api(async (_request, { user }) => ok(await listNotifications(user)));
