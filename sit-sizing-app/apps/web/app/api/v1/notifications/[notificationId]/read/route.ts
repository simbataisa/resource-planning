import { api, ok } from '@/server/http/authed';
import { NotificationParams } from '@/server/http/params';
import { markRead } from '@/server/services/notifications';

export const dynamic = 'force-dynamic';

export const POST = api<{ notificationId: string }>(async (_request, { user, params }) =>
  ok(await markRead(user, NotificationParams.parse(params).notificationId)),
);
