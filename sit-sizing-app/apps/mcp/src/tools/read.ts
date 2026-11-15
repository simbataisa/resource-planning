import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  Estimate,
  EstimateDetail,
  Id,
  Me,
  Profile,
  ProfileDetail,
  Project,
  Version,
  VersionCompare,
  page,
} from '@sit/schemas';
import { z } from 'zod';
import { ApiCallError } from '../errors';
import { defineTool, type ToolContext } from '../context';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/** A saved version number, or `'draft'` for the open draft (resolved with `get_estimate`'s data). */
export const VersionRef = z
  .union([z.number().int().min(1), z.literal('draft')])
  .describe("A version number (1 or more), or 'draft' for the estimate's open draft.");

const PageArgs = {
  cursor: Id.optional().describe('`nextCursor` from the previous page, to get the next one.'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page (default 50).'),
};

const seg = encodeURIComponent;

/** Resolves `'draft'` to the draft's version number; says what to do when there is none. */
export async function versionNumber(
  ctx: ToolContext,
  estimateId: string,
  ref: z.infer<typeof VersionRef>,
): Promise<number> {
  if (ref !== 'draft') return ref;
  const estimate = await ctx.api.get(`/estimates/${seg(estimateId)}`, EstimateDetail);
  const draft = estimate.versions.find((v) => v.status === 'DRAFT');
  if (!draft) {
    throw new ApiCallError({
      status: 409,
      code: 'NO_DRAFT',
      message:
        'This estimate has no open draft. Call start_draft to open one, or ask for a saved version number.',
    });
  }
  return draft.number;
}

/** Read tools (design spec 6.3). All read-only; each calls the API as the signed-in user. */
export function registerReadTools(server: McpServer, ctx: ToolContext): void {
  defineTool(
    server,
    ctx,
    'whoami',
    {
      title: 'Who am I',
      description:
        'The signed-in SIT Sizing user: name, global role, preferred language and role in each project.',
      outputSchema: Me,
      annotations: READ_ONLY,
    },
    () => ctx.me(),
  );

  defineTool(
    server,
    ctx,
    'list_projects',
    {
      title: 'List projects',
      description: 'Projects the signed-in user can see, with their role in each.',
      inputSchema: z.object(PageArgs),
      outputSchema: page(Project),
      annotations: READ_ONLY,
    },
    ({ cursor, limit }) => ctx.api.get('/projects', page(Project), { cursor, limit }),
  );

  defineTool(
    server,
    ctx,
    'list_estimates',
    {
      title: 'List estimates',
      description:
        "A project's estimates, each with its latest saved version and whether a draft is open.",
      inputSchema: z.object({ projectId: Id, ...PageArgs }),
      outputSchema: page(Estimate),
      annotations: READ_ONLY,
    },
    ({ projectId, cursor, limit }) =>
      ctx.api.get(`/projects/${seg(projectId)}/estimates`, page(Estimate), { cursor, limit }),
  );

  defineTool(
    server,
    ctx,
    'get_estimate',
    {
      title: 'Get estimate',
      description: 'One estimate with all its versions (summaries) and the edit lock on its draft.',
      inputSchema: z.object({ estimateId: Id }),
      outputSchema: EstimateDetail,
      annotations: READ_ONLY,
    },
    ({ estimateId }) => ctx.api.get(`/estimates/${seg(estimateId)}`, EstimateDetail),
  );

  defineTool(
    server,
    ctx,
    'get_version',
    {
      title: 'Get version',
      description:
        'One version in full: inputs, assumptions and calculated results. Use number "draft" for the open draft.',
      inputSchema: z.object({ estimateId: Id, number: VersionRef }),
      outputSchema: Version,
      annotations: READ_ONLY,
    },
    async ({ estimateId, number }) => {
      const n = await versionNumber(ctx, estimateId, number);
      return ctx.api.get(`/estimates/${seg(estimateId)}/versions/${n}`, Version);
    },
  );

  defineTool(
    server,
    ctx,
    'compare_versions',
    {
      title: 'Compare versions',
      description:
        'Two versions of one estimate side by side: headline results, group totals and the changed inputs and assumptions.',
      inputSchema: z.object({ estimateId: Id, a: VersionRef, b: VersionRef }),
      outputSchema: VersionCompare,
      annotations: READ_ONLY,
    },
    async ({ estimateId, a, b }) => {
      const [na, nb] = [
        await versionNumber(ctx, estimateId, a),
        await versionNumber(ctx, estimateId, b),
      ];
      return ctx.api.get(`/estimates/${seg(estimateId)}/compare`, VersionCompare, { a: na, b: nb });
    },
  );

  defineTool(
    server,
    ctx,
    'list_profiles',
    {
      title: 'List assumption profiles',
      description:
        "Published assumption profiles: the global ones, plus the project's own when projectId is given. Draft and retired profiles are not listed.",
      inputSchema: z.object({ projectId: Id.optional() }),
      outputSchema: z.object({ items: z.array(Profile) }),
      annotations: READ_ONLY,
    },
    async ({ projectId }) => {
      const all = await ctx.api.get('/profiles', z.object({ items: z.array(Profile) }), {
        projectId,
      });
      return { items: all.items.filter((p) => p.status === 'PUBLISHED') };
    },
  );

  defineTool(
    server,
    ctx,
    'get_profile',
    {
      title: 'Get assumption profile',
      description: 'One assumption profile with all its values and calibration notes.',
      inputSchema: z.object({ profileId: Id }),
      outputSchema: ProfileDetail,
      annotations: READ_ONLY,
    },
    ({ profileId }) => ctx.api.get(`/profiles/${seg(profileId)}`, ProfileDetail),
  );
}
