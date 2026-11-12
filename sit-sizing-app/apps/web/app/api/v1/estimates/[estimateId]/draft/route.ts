import { DraftCreate, DraftPatch } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { EstimateParams } from '@/server/http/params';
import { readJson } from '@/server/http/parse';
import { createDraft, patchDraft } from '@/server/services/versions';

export const dynamic = 'force-dynamic';

/** Start a new draft from a saved version (default: the latest). */
export const POST = api<{ estimateId: string }>(async (request, { user, params, requestId }) =>
  ok(
    await createDraft(
      user,
      EstimateParams.parse(params).estimateId,
      await readJson(request, DraftCreate),
      { requestId },
    ),
    201,
  ),
);

/** Autosave: the server recomputes and returns the draft with its new rowVersion. */
export const PATCH = api<{ estimateId: string }>(async (request, { user, params }) =>
  ok(
    await patchDraft(
      user,
      EstimateParams.parse(params).estimateId,
      await readJson(request, DraftPatch),
    ),
  ),
);
