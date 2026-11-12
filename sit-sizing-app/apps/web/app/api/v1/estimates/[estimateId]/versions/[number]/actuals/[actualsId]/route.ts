import { api } from '@/server/http/authed';
import { ActualsParams } from '@/server/http/params';
import { deleteActuals } from '@/server/services/actuals';

export const dynamic = 'force-dynamic';

export const DELETE = api<{ estimateId: string; number: string; actualsId: string }>(
  async (_request, { user, params, requestId }) => {
    const p = ActualsParams.parse(params);
    await deleteActuals(user, p.estimateId, p.number, p.actualsId, { requestId });
    return new Response(null, { status: 204 });
  },
);
