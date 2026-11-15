import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  Assumptions,
  ChangeSummary,
  Estimate,
  EstimateCreated,
  EstimateDetail,
  EstimateInputs,
  Id,
  Version,
} from '@sit/schemas';
import { z } from 'zod';
import { defineTool, type ToolContext } from '../context';
import { ApiCallError, hasReason } from '../errors';
import { applyChanges, PathError } from '../merge';

/** Not read-only, not destructive (no tool deletes anything), not idempotent (design 6.5). */
const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

/**
 * Prefix of the default version note, so the history shows the version was prepared with
 * the assistant (design 6.3). Data, not UI text: stored as written, in English.
 */
export const NOTE_PREFIX = 'Prepared with the estimation assistant: ';

const Summary = ChangeSummary.describe(
  'One sentence stating what the user agreed to in chat. Required; recorded in the audit trail.',
);
const Note = z.string().trim().max(2000);

const seg = encodeURIComponent;

/** A refusal the assistant can act on, shown as `"<CODE>: <message>"`. */
function refusal(code: string, message: string): ApiCallError {
  return new ApiCallError({ status: 409, code, message });
}

function unlockFailed(ctx: ToolContext, code: string): false {
  ctx.log.warn({ event: 'draft_unlock_failed', code }, 'could not release the draft edit lock');
  return false;
}

/**
 * Releases the draft lock with the token of the call that took it (`X-Lock-Token`), so it
 * can only end the lock this session took. A failure is logged with its error code only
 * (no arguments, no tokens) and reported as `false`; it never throws, so it cannot mask
 * another error. Without a token there is nothing this session can release (`NO_LOCK_TOKEN`).
 * `noChallenge`: a 401 here must not turn a write that already happened into an auth
 * challenge, which a client would answer by replaying the (non-idempotent) call.
 */
async function releaseLock(
  ctx: ToolContext,
  estimateId: string,
  lockToken: string | undefined,
): Promise<boolean> {
  if (!lockToken) return unlockFailed(ctx, 'NO_LOCK_TOKEN');
  try {
    await ctx.api.del(`/estimates/${seg(estimateId)}/draft/lock`, { noChallenge: true, lockToken });
    return true;
  } catch (err) {
    return unlockFailed(ctx, err instanceof ApiCallError ? err.code : 'UNKNOWN');
  }
}

/** Drops the lock token from an API answer: it is never part of a tool's output. */
function withoutToken<T extends { lockToken?: string }>(value: T): Omit<T, 'lockToken'> {
  const { lockToken: _token, ...rest } = value;
  return rest;
}

export interface DraftLockOptions {
  /** Validation before the lock state is checked and the lock taken; gets the draft number. */
  beforeLock?: (draftNumber: number) => Promise<void>;
  /** The call in `fn` releases the lock itself when it succeeds (saving a version). */
  consumesLock?: boolean;
}

/**
 * Reads the estimate and refuses unless it has a draft that nobody holds. Any lock the
 * server reports counts: `draftLock` is null unless the lock is active on the server's
 * clock, so no local expiry check is made (a fast client clock would otherwise treat the
 * user's live editor lock as expired, renew it and then release it).
 */
async function unlockedDraft(ctx: ToolContext, base: string) {
  const estimate = await ctx.api.get(base, EstimateDetail);
  const draft = estimate.hasDraft ? estimate.versions.find((v) => v.status === 'DRAFT') : undefined;
  if (!draft) throw refusal('NO_DRAFT', 'call start_draft first');
  const lock = estimate.draftLock;
  if (lock?.mine) throw refusal('EDITOR_OPEN', 'close the draft in the editor first');
  if (lock) throw refusal('LOCKED', `held by ${lock.holder.displayName} until ${lock.expiresAt}`);
  return draft;
}

/**
 * Takes the draft edit lock for one write and always gives it back (Review Focus 1):
 * 1. Reads the estimate. No draft ⇒ `NO_DRAFT`. A lock held by the user (the editor is
 *    open) ⇒ `EDITOR_OPEN`; by someone else ⇒ `LOCKED`. No lock call then.
 * 2. With `beforeLock`: runs it (the validation read), then reads the lock state again,
 *    so the last check sits right before the lock call.
 * 3. Takes the lock with `takeover: false` (never a takeover) and no token, and passes the
 *    draft the lock call returned (its `rowVersion` is the one to send) to `fn`, with the
 *    `lockToken` that call returned, which `fn` sends as `X-Lock-Token` on its write.
 * 4. Releases the lock afterwards with that token, also when `fn` throws. No retry.
 * A lock it did not take (a failed lock call, or a refusal) is never released.
 *
 * If the editor takes the lock between the last check and the lock call, the API refuses
 * the lock call (the tool has no token for the editor's lock: `LOCKED_ELSEWHERE`, or `RACE`
 * when both race for a free lock); the tool answers `EDITOR_OPEN` with no write or release.
 */
export async function withDraftLock<T>(
  ctx: ToolContext,
  estimateId: string,
  fn: (draft: Omit<Version, 'lockToken'>, lockToken: string | undefined) => Promise<T>,
  opts: DraftLockOptions = {},
): Promise<T> {
  const base = `/estimates/${seg(estimateId)}`;
  const draft = await unlockedDraft(ctx, base);
  if (opts.beforeLock) {
    await opts.beforeLock(draft.number);
    await unlockedDraft(ctx, base);
  }

  let locked: Version;
  try {
    locked = await ctx.api.post(`${base}/draft/lock`, { takeover: false }, Version);
  } catch (err) {
    if (err instanceof ApiCallError && hasReason(err, 'RACE')) {
      throw refusal(
        'EDITOR_OPEN',
        'close the draft in the editor first, or another session took it',
      );
    }
    throw err; // LOCKED_ELSEWHERE becomes EDITOR_OPEN in toToolResult.
  }
  const lockToken = locked.lockToken;
  let succeeded = false;
  try {
    const result = await fn(withoutToken(locked), lockToken);
    succeeded = true;
    return result;
  } finally {
    if (!(succeeded && opts.consumesLock)) await releaseLock(ctx, estimateId, lockToken);
  }
}

/** The whole draft content that `update_draft` validates before anything is written. */
const DraftDoc = z.object({ inputs: EstimateInputs, assumptions: Assumptions });

const Change = z.object({
  path: z
    .string()
    .min(1)
    .max(200)
    .describe(
      'Dotted path starting with inputs. or assumptions. (e.g. inputs.team.weeks, assumptions.cases.api.1).',
    ),
  value: z.unknown().describe('The new value; replaces the whole value at the path.'),
});

/** Write tools (design spec 6.3, 6.5). Each needs the user's confirmation in chat first. */
export function registerWriteTools(server: McpServer, ctx: ToolContext): void {
  defineTool(
    server,
    ctx,
    'create_estimate',
    {
      title: 'Create estimate',
      description:
        'Creates an estimate in a project from a blank scope, with draft version 1. Uses the given assumption profile, or the published global default. Ask the user to confirm first.',
      inputSchema: z.object({
        projectId: Id,
        name: z.string().trim().min(1).max(160),
        description: z.string().trim().max(2000).optional(),
        profileId: Id.optional().describe('A published assumption profile (see list_profiles).'),
        summary: Summary,
      }),
      outputSchema: Estimate,
      annotations: WRITE,
    },
    async ({ projectId, name, description, profileId, summary }) => {
      const estimate = await ctx.api.post(
        `/projects/${seg(projectId)}/estimates`,
        {
          name,
          ...(description !== undefined ? { description } : {}),
          template: 'blank',
          ...(profileId !== undefined ? { profileId } : {}),
          summary,
        },
        EstimateCreated,
      );
      // The new draft comes back locked to the caller, with its token; give the lock back
      // so the editor and later write tools can take it.
      await releaseLock(ctx, estimate.id, estimate.lockToken);
      return withoutToken(estimate);
    },
  );

  defineTool(
    server,
    ctx,
    'start_draft',
    {
      title: 'Start draft',
      description:
        'Opens a draft on an estimate, copied from its latest version or the given one. Fails if a draft is already open. Ask the user to confirm first.',
      inputSchema: z.object({
        estimateId: Id,
        fromVersion: z.number().int().min(1).optional(),
        summary: Summary,
      }),
      outputSchema: Version,
      annotations: WRITE,
    },
    async ({ estimateId, fromVersion, summary }) => {
      const draft = await ctx.api.post(
        `/estimates/${seg(estimateId)}/draft`,
        { ...(fromVersion !== undefined ? { fromVersion } : {}), summary },
        Version,
      );
      // Like create_estimate: the new draft is locked to the caller; release that lock with
      // the token this POST returned (none ⇒ nothing to release; the answer keeps the lock).
      const released = await releaseLock(ctx, estimateId, draft.lockToken);
      const out = withoutToken(draft);
      return released ? { ...out, lock: null } : out;
    },
  );

  defineTool(
    server,
    ctx,
    'update_draft',
    {
      title: 'Update draft',
      description:
        "Changes values in the estimate's open draft: input fields and/or assumption rows, each by path. The whole draft is validated before anything is written; the server recalculates and the stored result is returned. Fails without retrying if someone else changed or holds the draft. Ask the user to confirm first.",
      inputSchema: z.object({
        estimateId: Id,
        changes: z.array(Change).min(1).max(200),
        note: Note.optional().describe("Replaces the draft's note."),
        summary: Summary,
      }),
      outputSchema: Version,
      annotations: WRITE,
    },
    async ({ estimateId, changes, note, summary }) => {
      for (const c of changes) {
        if (!/^(inputs|assumptions)\./.test(c.path)) {
          throw new PathError(c.path, 'must start with inputs. or assumptions.');
        }
      }
      const areas = new Set(changes.map((c) => c.path.split('.')[0]));
      const build = (v: Version) =>
        DraftDoc.parse(applyChanges({ inputs: v.inputs, assumptions: v.assumptions }, changes));
      const base = `/estimates/${seg(estimateId)}`;
      return withDraftLock(
        ctx,
        estimateId,
        async (draft, lockToken) => {
          // Re-apply on the draft read under the lock, so nothing changed in between is lost.
          const doc = build(draft);
          return ctx.api.patch(
            `${base}/draft`,
            {
              rowVersion: draft.rowVersion,
              ...(areas.has('inputs') ? { inputs: doc.inputs } : {}),
              ...(areas.has('assumptions') ? { assumptions: doc.assumptions } : {}),
              ...(note !== undefined ? { note } : {}),
              summary,
            },
            Version,
            { lockToken },
          );
        },
        {
          // Validate on the draft read without a lock: a bad path or value takes no lock
          // and writes nothing (Review Focus 3).
          beforeLock: async (n) => {
            build(await ctx.api.get(`${base}/versions/${n}`, Version));
          },
        },
      );
    },
  );

  defineTool(
    server,
    ctx,
    'apply_profile',
    {
      title: 'Apply assumption profile',
      description:
        "Replaces all assumption values in the estimate's open draft with a published profile's values. Ask the user to confirm first.",
      inputSchema: z.object({ estimateId: Id, profileId: Id, summary: Summary }),
      outputSchema: Version,
      annotations: WRITE,
    },
    ({ estimateId, profileId, summary }) =>
      withDraftLock(ctx, estimateId, (draft, lockToken) =>
        ctx.api.post(
          `/estimates/${seg(estimateId)}/draft/profile`,
          { profileId, rowVersion: draft.rowVersion, summary },
          Version,
          { lockToken },
        ),
      ),
  );

  defineTool(
    server,
    ctx,
    'save_version',
    {
      title: 'Save version',
      description:
        'Saves the open draft as a numbered, unchangeable version. Without a note, the note of the draft is kept; if the draft has none, the note says it was prepared with the assistant and repeats the summary. Saving never submits for review. Ask the user to confirm first.',
      inputSchema: z.object({ estimateId: Id, note: Note.optional(), summary: Summary }),
      outputSchema: Version,
      annotations: WRITE,
    },
    ({ estimateId, note, summary }) =>
      // Saving needs the edit lock and clears it itself, so a successful save is not unlocked.
      withDraftLock(
        ctx,
        estimateId,
        (draft, lockToken) =>
          ctx.api.post(
            `/estimates/${seg(estimateId)}/versions`,
            // Like the API, keep the draft's own note; the assistant note only fills a gap.
            { note: note ?? (draft.note ? draft.note : `${NOTE_PREFIX}${summary}`), summary },
            Version,
            { lockToken },
          ),
        { consumesLock: true },
      ),
  );

  defineTool(
    server,
    ctx,
    'submit_version',
    {
      title: 'Submit version for review',
      description:
        'Submits a saved version for review by a QE Lead. A separate step from saving; ask the user to confirm it on its own.',
      inputSchema: z.object({
        estimateId: Id,
        number: z.number().int().min(1),
        note: Note.optional(),
        summary: Summary,
      }),
      outputSchema: Version,
      annotations: WRITE,
    },
    ({ estimateId, number, note, summary }) =>
      ctx.api.post(
        `/estimates/${seg(estimateId)}/versions/${number}/submit`,
        { ...(note !== undefined ? { note } : {}), summary },
        Version,
      ),
  );
}
