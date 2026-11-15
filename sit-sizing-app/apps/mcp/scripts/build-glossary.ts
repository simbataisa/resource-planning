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
import { ASSUMPTION_META } from '../../web/lib/assumption-meta.ts';

export const GENERATED_DIR = new URL('../src/generated/', import.meta.url);
const MESSAGES_DIR = new URL('../../web/messages/', import.meta.url);

/**
 * Message groups the tools read; `editor.rough` holds the rough-scope field labels and
 * `results.sens.items` the sensitivity (tornado) row labels.
 */
const GROUPS = ['catalogue', 'detailTab', 'evidenceTab', 'teamTab', 'assumptionsTab'] as const;

export interface AssumptionRowMeta {
  path: string;
  group: string;
  labelKey: string;
  /** Values interpolated into the label (`Size {s}`). */
  labelValues?: Record<string, string>;
  unitKey?: string;
}

function messages(locale: 'en' | 'vi'): Record<string, unknown> {
  const all = JSON.parse(readFileSync(new URL(`${locale}.json`, MESSAGES_DIR), 'utf8')) as Record<
    string,
    Record<string, unknown>
  >;
  const out: Record<string, unknown> = {};
  for (const g of GROUPS) out[g] = all[g];
  out.editor = { rough: all.editor?.rough };
  const sens = all.results?.sens as Record<string, unknown> | undefined;
  out.results = { sens: { items: sens?.items } };
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
export function buildGlossary(): Record<string, string> {
  return {
    'assumption-rows.json': json(assumptionRows()),
    'messages.en.json': json(messages('en')),
    'messages.vi.json': json(messages('vi')),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(GENERATED_DIR, { recursive: true });
  for (const [name, text] of Object.entries(buildGlossary())) {
    writeFileSync(new URL(name, GENERATED_DIR), text);
    process.stdout.write(`wrote ${fileURLToPath(new URL(name, GENERATED_DIR))}\n`);
  }
}
