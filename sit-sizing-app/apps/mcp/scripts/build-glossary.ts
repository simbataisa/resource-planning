/**
 * Copies the editor's wording into `src/generated/` so the MCP tools serve the same labels
 * as the web app without importing it at runtime (design spec 6.4). Run after a change to
 * the message files or the assumption layout: `pnpm --filter @sit/mcp glossary`.
 * A test fails when the committed files differ from a fresh run.
 *
 * Runs with `node` (type stripping), so imports carry their `.ts` extension.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ASSUMPTION_PATHS } from '@sit/engine';
import { z } from 'zod';
import { ASSUMPTION_META } from '../../web/lib/assumption-meta.ts';

export const GENERATED_DIR = new URL('../src/generated/', import.meta.url);
const MESSAGES_DIR = new URL('../../web/messages/', import.meta.url);

/** Message groups the tools read; `editor.rough` holds the rough-scope field labels. */
const GROUPS = ['catalogue', 'detailTab', 'evidenceTab', 'teamTab', 'assumptionsTab'] as const;

export interface AssumptionRowMeta {
  path: string;
  group: string;
  labelKey: string;
  /** Values interpolated into the label (`Size {s}`). */
  labelValues?: Record<string, string>;
  unitKey?: string;
}

const HELP_PREFIX = 'assumptionsTab.help.';
const APPROVAL_URL = new URL('../../../docs/i18n/assumption-help-approved.json', import.meta.url);

/**
 * The QE practice lead's approval record (design spec 6.4). A row is a full help key, such as
 * `assumptionsTab.help.minutes_1`. Rows may only be listed once the approver is named and dated.
 */
const ApprovalRecordSchema = z
  .strictObject({
    approvedBy: z.string().min(1).nullable(),
    approvedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    rows: z.array(
      z
        .string()
        .startsWith(HELP_PREFIX)
        .min(HELP_PREFIX.length + 1),
    ),
  })
  .refine((r) => r.rows.length === 0 || (r.approvedBy !== null && r.approvedOn !== null), {
    message: 'rows can only be approved when approvedBy and approvedOn are filled in',
  });
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

export function parseApprovalRecord(raw: unknown): ApprovalRecord {
  const parsed = ApprovalRecordSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`assumption-help-approved.json is invalid: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

type Messages = Record<string, Record<string, unknown>>;

export interface GlossarySource {
  messages: { en: Messages; vi: Messages };
  approval: unknown;
}

function readSource(): GlossarySource {
  const read = (url: URL) => JSON.parse(readFileSync(url, 'utf8')) as unknown;
  return {
    messages: {
      en: read(new URL('en.json', MESSAGES_DIR)) as Messages,
      vi: read(new URL('vi.json', MESSAGES_DIR)) as Messages,
    },
    approval: read(APPROVAL_URL),
  };
}

/** The `assumptionsTab` group with only the approved help keys left in. */
function approvedAssumptionsTab(
  tab: Record<string, unknown> | undefined,
  approved: string[],
  language: string,
): Record<string, unknown> | undefined {
  if (!tab) return tab;
  const { help, ...rest } = tab;
  if (approved.length === 0) return rest;
  const all = (help ?? {}) as Record<string, unknown>;
  const kept: Record<string, unknown> = {};
  for (const key of approved) {
    const text = all[key.slice(HELP_PREFIX.length)];
    if (typeof text !== 'string' || text === '') {
      throw new Error(`Approved explanation ${key} has no ${language} text in the web messages`);
    }
    kept[key.slice(HELP_PREFIX.length)] = text;
  }
  return { ...rest, help: kept };
}

function messages(all: Messages, approved: string[], language: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const g of GROUPS) out[g] = all[g];
  out.assumptionsTab = approvedAssumptionsTab(all.assumptionsTab, approved, language);
  out.editor = { rough: all.editor?.rough };
  return out;
}

function assumptionRows(): AssumptionRowMeta[] {
  const byPath = new Map<string, AssumptionRowMeta>();
  for (const { group, rows } of ASSUMPTION_META) {
    for (const row of rows) {
      const meta: AssumptionRowMeta = { path: row.path, group, labelKey: row.label.key };
      if (row.label.values) meta.labelValues = row.label.values;
      if (row.kind === 'cols' || row.kind === 'scalar') {
        meta.unitKey = `assumptionsTab.units.${row.unit}`;
      } else if (row.kind === 'pct') {
        // Stored as a share 0–1; the editor shows it as a percentage.
        meta.unitKey = 'assumptionsTab.units.share';
      }
      byPath.set(row.path, meta);
    }
  }
  return ASSUMPTION_PATHS.map((path) => {
    const meta = byPath.get(path);
    if (!meta) throw new Error(`No assumption layout row for ${path}`);
    return meta;
  });
}

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

/** The generated files, by name, as text. */
export function buildGlossary(source: GlossarySource = readSource()): Record<string, string> {
  const approved = [...new Set(parseApprovalRecord(source.approval).rows)];
  return {
    'assumption-rows.json': json(assumptionRows()),
    'messages.en.json': json(messages(source.messages.en, approved, 'English')),
    'messages.vi.json': json(messages(source.messages.vi, approved, 'Vietnamese')),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(GENERATED_DIR, { recursive: true });
  for (const [name, text] of Object.entries(buildGlossary())) {
    writeFileSync(new URL(name, GENERATED_DIR), text);
    process.stdout.write(`wrote ${fileURLToPath(new URL(name, GENERATED_DIR))}\n`);
  }
}
