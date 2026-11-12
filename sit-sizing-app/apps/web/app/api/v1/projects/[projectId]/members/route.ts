import { MembersPut } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { ProjectParams } from '@/server/http/params';
import { readJson } from '@/server/http/parse';
import { putMembers } from '@/server/services/projects';

export const dynamic = 'force-dynamic';

export const PUT = api<{ projectId: string }>(async (request, { user, params, requestId }) =>
  ok(
    await putMembers(
      user,
      ProjectParams.parse(params).projectId,
      await readJson(request, MembersPut),
      { requestId },
    ),
  ),
);
