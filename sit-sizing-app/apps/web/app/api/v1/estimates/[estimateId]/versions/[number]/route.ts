import { api, ok } from '@/server/http/authed';
import { VersionParams } from '@/server/http/params';
import { getVersion } from '@/server/services/versions';

export const dynamic = 'force-dynamic';

export const GET = api<{ estimateId: string; number: string }>(
  async (_request, { user, params }) => {
    const p = VersionParams.parse(params);
    return ok(await getVersion(user, p.estimateId, p.number));
  },
);
