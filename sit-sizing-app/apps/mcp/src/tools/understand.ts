import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  computeBoth,
  DEFAULT_ASSUMPTIONS,
  gapRows,
  sensitivity,
  toStoredResult,
  topGap,
  uncalibratedCount,
} from '@sit/engine';
import {
  Assumptions,
  EstimateInputs,
  GroupKey,
  GroupResult,
  Id,
  ModeSummary,
  ProfileDetail,
  Version,
} from '@sit/schemas';
import { z } from 'zod';
import { defineTool, type Locale, type ToolContext } from '../context';
import { ApiCallError, invalidInput } from '../errors';
import {
  ASSUMPTION_GROUPS,
  AssumptionRow,
  describeAssumptions,
  describeInputs,
  INPUT_GROUPS,
  InputField,
  sensitivityLabel,
} from '../glossary';
import { applyChanges, PathError } from '../merge';
import { VersionRef, versionNumber } from './read';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
/** Assumptions moved ±25% for the sensitivity rows, as the editor does by default. */
const SWING = 0.25;
const seg = encodeURIComponent;

const LocaleArg = z
  .enum(['en', 'vi'])
  .optional()
  .describe("Language of labels and explanations; defaults to the user's language.");

const Headline = ModeSummary.omit({ groups: true });
const SensitivityRow = z.object({
  key: z.string().describe('Sensitivity item (same keys as the editor tornado chart).'),
  label: z.string().nullable().describe('The editor label of the item; null when it has none.'),
  lo: z.number(),
  hi: z.number(),
  span: z.number(),
});

const PreviewResult = z.object({
  preview: z.literal(true).describe('Always true: these numbers are a preview and were not saved.'),
  engineVersion: z.string(),
  rough: Headline,
  detailed: Headline,
  groups: z
    .array(
      z.object({
        group: GroupKey,
        rough: GroupResult,
        detailed: GroupResult,
        share: z.number().describe('Share (%) of the hours gap between rough and detailed.'),
      }),
    )
    .describe('Driver groups with cases or hours in either mode.'),
  topGap: z
    .object({ group: GroupKey, deltaHours: z.number(), share: z.number() })
    .nullable()
    .describe('The group that explains most of the rough vs detailed gap; null when they agree.'),
  sensitivity: z.object({
    swing: z.number(),
    rough: z.array(SensitivityRow),
    detailed: z.array(SensitivityRow),
  }),
  uncalibrated: z.number().int().describe('Assumption rows still at their default (of 142).'),
});

/** The whole object a preview validates before it runs the engine. */
const PreviewDoc = z.object({ inputs: EstimateInputs, assumptions: Assumptions });

const PreviewArgs = z.object({
  inputs: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Full EstimateInputs (see describe_inputs; at most 500 features). Not with base.'),
  assumptions: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Full Assumptions; defaults to the standard defaults (or to the base version).'),
  base: z
    .object({ estimateId: Id, number: VersionRef })
    .optional()
    .describe('A saved version (or the draft) to start from instead of full inputs.'),
  changes: z
    .array(
      z.object({
        path: z
          .string()
          .min(1)
          .max(200)
          .describe('Dotted path starting with inputs. or assumptions. (e.g. inputs.team.weeks).'),
        value: z.unknown(),
      }),
    )
    .max(200)
    .optional()
    .describe('Values to replace before computing. Each path must already exist.'),
  locale: LocaleArg,
});

/** Understand tools (design spec 6.3–6.4): explain fields and preview numbers; nothing is saved. */
export function registerUnderstandTools(server: McpServer, ctx: ToolContext): void {
  const localeOf = async (l: Locale | undefined) => l ?? (await ctx.locale());

  defineTool(
    server,
    ctx,
    'describe_inputs',
    {
      title: 'Describe inputs',
      description:
        'The estimate input fields as the editor groups them, each with its label, meaning, type and allowed range.',
      inputSchema: z.object({ group: z.enum(INPUT_GROUPS).optional(), locale: LocaleArg }),
      outputSchema: z.object({ fields: z.array(InputField) }),
      annotations: READ_ONLY,
    },
    async ({ group, locale }) => ({
      fields: describeInputs({ locale: await localeOf(locale), group }),
    }),
  );

  defineTool(
    server,
    ctx,
    'describe_assumptions',
    {
      title: 'Describe assumptions',
      description:
        'The 142 assumption rows: path, label, meaning and default. Given a version (estimateId and number) or a profile, also the current value, whether it is calibrated, and its source and measured date where known.',
      inputSchema: z.object({
        group: z.enum(ASSUMPTION_GROUPS).optional(),
        paths: z.array(z.string().max(80)).max(142).optional(),
        estimateId: Id.optional(),
        number: VersionRef.optional(),
        profileId: Id.optional(),
        locale: LocaleArg,
      }),
      outputSchema: z.object({ rows: z.array(AssumptionRow), uncalibrated: z.number().int() }),
      annotations: READ_ONLY,
    },
    async ({ group, paths, estimateId, number, profileId, locale }) => {
      if (profileId && (estimateId || number !== undefined)) {
        throw invalidInput(
          'profileId',
          'Give a version (estimateId and number) or a profile, not both.',
        );
      }
      if (!estimateId !== (number === undefined)) {
        throw invalidInput(
          estimateId ? 'number' : 'estimateId',
          'estimateId and number go together.',
        );
      }
      const lang = await localeOf(locale);
      // Unknown paths are refused before any API call.
      describeAssumptions({ locale: lang, paths });
      let values: Assumptions | undefined;
      let calibration: ProfileDetail['calibration'] | undefined;
      if (estimateId && number !== undefined) {
        const n = await versionNumber(ctx, estimateId, number);
        const version = await ctx.api.get(`/estimates/${seg(estimateId)}/versions/${n}`, Version);
        values = version.assumptions;
        if (version.profileId) calibration = await profileCalibration(ctx, version.profileId);
      } else if (profileId) {
        const profile = await ctx.api.get(`/profiles/${seg(profileId)}`, ProfileDetail);
        values = profile.values;
        calibration = profile.calibration;
      }
      return {
        rows: describeAssumptions({ locale: lang, group, paths, values, calibration }),
        uncalibrated: uncalibratedCount(values ?? DEFAULT_ASSUMPTIONS, DEFAULT_ASSUMPTIONS),
      };
    },
  );

  defineTool(
    server,
    ctx,
    'preview_estimate',
    {
      title: 'Preview estimate',
      description:
        'Runs the calculation on proposed inputs and assumptions, or on a saved version plus changes, and returns the headline figures, group breakdown, top gap, sensitivity and uncalibrated count. Saves nothing: the result is a preview, not a stored version.',
      inputSchema: PreviewArgs,
      outputSchema: PreviewResult,
      annotations: READ_ONLY,
    },
    async ({ inputs, assumptions, base, changes, locale }) => {
      if (inputs && base) throw invalidInput('base', 'Give either full inputs or base, not both.');
      if (!inputs && !base) {
        throw invalidInput('inputs', 'Give full inputs, or base with changes.');
      }
      for (const c of changes ?? []) {
        if (!/^(inputs|assumptions)\./.test(c.path)) {
          throw new PathError(c.path, 'must start with inputs. or assumptions.');
        }
      }
      let start: { inputs: unknown; assumptions: unknown };
      if (base) {
        const n = await versionNumber(ctx, base.estimateId, base.number);
        const version = await ctx.api.get(
          `/estimates/${seg(base.estimateId)}/versions/${n}`,
          Version,
        );
        start = { inputs: version.inputs, assumptions: assumptions ?? version.assumptions };
      } else {
        start = { inputs, assumptions: assumptions ?? DEFAULT_ASSUMPTIONS };
      }
      // Validate the whole object before the engine sees it (Review Focus 5).
      const doc = PreviewDoc.parse(applyChanges(start, changes ?? []));
      return preview(doc.inputs, doc.assumptions, await localeOf(locale));
    },
  );
}

/**
 * The calibration notes of the profile a version was built from; undefined when the
 * caller cannot read that profile (gone or out of reach), so the rows still answer.
 */
async function profileCalibration(
  ctx: ToolContext,
  profileId: string,
): Promise<ProfileDetail['calibration'] | undefined> {
  try {
    return (await ctx.api.get(`/profiles/${seg(profileId)}`, ProfileDetail)).calibration;
  } catch (err) {
    if (err instanceof ApiCallError && (err.status === 404 || err.status === 403)) return undefined;
    throw err;
  }
}

function preview(
  inputs: EstimateInputs,
  assumptions: Assumptions,
  locale: Locale,
): z.infer<typeof PreviewResult> {
  const rows = (mode: 'rough' | 'detailed') =>
    sensitivity(mode, inputs, assumptions, SWING).rows.map((r) => ({
      ...r,
      label: sensitivityLabel(locale, r.key),
    }));
  const both = computeBoth(inputs, assumptions);
  const stored = toStoredResult(both);
  const { groups: roughGroups, ...rough } = stored.rough;
  const { groups: detailedGroups, ...detailed } = stored.detailed;
  return {
    preview: true,
    engineVersion: stored.engineVersion,
    rough,
    detailed,
    groups: gapRows(both).map((g) => ({
      group: g.group,
      rough: roughGroups[g.group],
      detailed: detailedGroups[g.group],
      share: g.share,
    })),
    topGap: topGap(both),
    sensitivity: {
      swing: SWING,
      rough: rows('rough'),
      detailed: rows('detailed'),
    },
    uncalibrated: uncalibratedCount(assumptions, DEFAULT_ASSUMPTIONS),
  };
}
