import { ProjectUpdate } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { ProjectParams } from '@/server/http/params';
import { readJson } from '@/server/http/parse';
import { getProject, updateProject } from '@/server/services/projects';

export const dynamic = 'force-dynamic';

export const GET = api<{ projectId: string }>(async (_request, { user, params }) =>
  ok(await getProject(user, ProjectParams.parse(params).projectId)),
);

export const PATCH = api<{ projectId: string }>(async (request, { user, params, requestId }) =>
  ok(
    await updateProject(
      user,
      ProjectParams.parse(params).projectId,
      await readJson(request, ProjectUpdate),
      { requestId },
    ),
  ),
);
