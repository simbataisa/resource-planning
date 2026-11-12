import { PageQuery, ProjectCreate } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { readJson, readQuery } from '@/server/http/parse';
import { createProject, listProjects } from '@/server/services/projects';

export const dynamic = 'force-dynamic';

export const GET = api(async (request, { user }) =>
  ok(await listProjects(user, readQuery(request, PageQuery))),
);

export const POST = api(async (request, { user, requestId }) =>
  ok(await createProject(user, await readJson(request, ProjectCreate), { requestId }), 201),
);
