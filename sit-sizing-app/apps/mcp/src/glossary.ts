import {
  DEFAULT_ASSUMPTIONS,
  FIELD_TYPES,
  isUncalibratedRow,
  PT_TYPES,
  SIZE_ROW_TABLES,
  SIZES,
} from '@sit/engine';
import type { Assumptions, CalibrationEntry } from '@sit/schemas';
import { z } from 'zod';
import type { Locale } from './context';
import rowsJson from './generated/assumption-rows.json' with { type: 'json' };
import enJson from './generated/messages.en.json' with { type: 'json' };
import viJson from './generated/messages.vi.json' with { type: 'json' };
import { PathError } from './merge';

type Calibration = Record<string, z.infer<typeof CalibrationEntry>>;

/**
 * The editor's wording for inputs and assumption rows (design spec 6.4), read from the
 * copies in `generated/` (`pnpm --filter @sit/mcp glossary`). Values are raw numbers;
 * the assistant formats them.
 */

type Tree = { [k: string]: string | Tree };
const MESSAGES: Record<Locale, Tree> = { en: enJson as Tree, vi: viJson as Tree };

interface RowMeta {
  path: string;
  group: string;
  labelKey: string;
  labelValues?: Record<string, string>;
  unitKey?: string;
}
const ROWS = rowsJson as RowMeta[];
const SIZE_GROUPS: ReadonlySet<string> = new Set(SIZE_ROW_TABLES);

/**
 * The rows for these sizes (ADR-0021): the generated rows without their size rows, with one
 * row per size added to each size group, in the order of `sizes`.
 */
function rowsFor(sizes: readonly string[]): RowMeta[] {
  const out: RowMeta[] = [];
  const done = new Set<string>();
  for (const r of ROWS) {
    if (!SIZE_GROUPS.has(r.group)) {
      out.push(r);
      continue;
    }
    if (done.has(r.group)) continue;
    done.add(r.group);
    for (const s of sizes)
      out.push({
        path: `${r.group}.${s}`,
        group: r.group,
        labelKey: 'assumptionsTab.size',
        labelValues: { s },
      });
  }
  return out;
}

/** True for a path shaped like a size row, whatever the size (checked once values are known). */
export function isSizeRowPath(path: string): boolean {
  return /^(d|a)?proxies\.[A-Za-z0-9+-]{1,6}$/.test(path);
}

/** The message at a dotted key, with `{name}` placeholders filled; undefined when absent. */
function t(locale: Locale, key: string, values?: Record<string, string>): string | undefined {
  const found = key
    .split('.')
    .reduce<string | Tree | undefined>(
      (n, k) => (n && typeof n === 'object' ? n[k] : undefined),
      MESSAGES[locale],
    );
  if (typeof found !== 'string') return undefined;
  return values ? found.replace(/\{(\w+)\}/g, (m, name: string) => values[name] ?? m) : found;
}

function getPath(o: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((n, k) => (n == null ? undefined : (n as Record<string, unknown>)[k]), o);
}

// ---- Assumptions ---------------------------------------------------------------

/** Assumption groups as the Assumptions tab shows them, in order. */
export const ASSUMPTION_GROUPS = [...new Set(ROWS.map((r) => r.group))] as [string, ...string[]];

export const AssumptionRow = z.object({
  path: z.string(),
  group: z.string(),
  label: z.string(),
  /** Unit of the value (or of each column), when the row has one. */
  unit: z.string().optional(),
  explanation: z.string().nullable(),
  default: z.unknown(),
  value: z.unknown().optional(),
  calibrated: z.boolean().optional(),
  source: z.string().optional(),
  measuredAt: z.string().optional(),
});
export type AssumptionRow = z.infer<typeof AssumptionRow>;

/**
 * The assumption rows (130 fixed plus 3 per size, 160 by default) with label, explanation and default; with `values`, also the
 * current value and whether it is calibrated (differs from the default); with
 * `calibration`, the source and measured date. Throws `PathError` for an unknown path.
 */
export function describeAssumptions(opts: {
  locale: Locale;
  group?: string;
  paths?: readonly string[];
  values?: Assumptions;
  calibration?: Calibration;
}): AssumptionRow[] {
  const { locale, group, paths, values, calibration } = opts;
  const rows = rowsFor((values ?? DEFAULT_ASSUMPTIONS).sizes);
  const known = new Set(rows.map((r) => r.path));
  for (const p of paths ?? []) {
    if (!known.has(p)) throw new PathError(p, 'is not an assumption row');
  }
  const wanted = paths ? new Set(paths) : undefined;
  return rows
    .filter((r) => (!group || r.group === group) && (!wanted || wanted.has(r.path)))
    .map((r) => {
      const row: AssumptionRow = {
        path: r.path,
        group: r.group,
        label: t(locale, r.labelKey, r.labelValues) ?? r.path,
        ...(r.unitKey ? { unit: t(locale, r.unitKey) } : {}),
        explanation:
          t(locale, `assumptionsTab.help.${r.path.replaceAll('.', '_')}`) ??
          (SIZE_GROUPS.has(r.group)
            ? t(locale, `assumptionsTab.help.sizeRow.${r.group}`, r.labelValues)
            : undefined) ??
          null,
        default: getPath(DEFAULT_ASSUMPTIONS, r.path),
      };
      if (values) {
        row.value = getPath(values, r.path);
        // Custom-size rows count as calibrated only with a note (ADR-0021).
        row.calibrated = !isUncalibratedRow(
          values,
          DEFAULT_ASSUMPTIONS,
          r.path,
          calibration ?? values.sizeNotes,
        );
      }
      const note = calibration?.[r.path];
      if (note) {
        row.source = note.source;
        if (note.measuredAt) row.measuredAt = note.measuredAt;
      }
      return row;
    });
}

// ---- Sensitivity ---------------------------------------------------------------

/** The results panel's label for a sensitivity row key; null when it has none. */
export function sensitivityLabel(locale: Locale, key: string): string | null {
  return t(locale, `results.sens.items.${key}`) ?? null;
}

// ---- Inputs --------------------------------------------------------------------

export const INPUT_GROUPS = [
  'features',
  'channels',
  'detail',
  'team',
  'evidence',
  'ptTypes',
] as const;
export type InputGroup = (typeof INPUT_GROUPS)[number];

export const InputField = z.object({
  /** Dotted path into EstimateInputs; `*` stands for a feature's index (`features.*.qty`). */
  path: z.string(),
  group: z.enum(INPUT_GROUPS),
  label: z.string(),
  explanation: z.string().nullable(),
  type: z.enum(['count', 'band3', 'percent', 'boolean', 'enum', 'text']),
  min: z.number().optional(),
  max: z.number().optional(),
  /** Allowed values, each as `value` or `value: label`. */
  options: z.array(z.string()).optional(),
});
export type InputField = z.infer<typeof InputField>;

type Explain = (locale: Locale) => string | undefined;

interface FieldDef {
  path: string;
  group: InputGroup;
  labelKey: string;
  explain?: Explain;
  type: InputField['type'];
  min?: number;
  max?: number;
  /** Allowed values and the message key of each one's label, if it has one. */
  options?: [string, string | undefined][];
}

const key =
  (k: string): Explain =>
  (l) =>
    t(l, k);
/** "Simple: …; Medium: …; Complex: …" from the complexity guide. */
const rubric =
  (base: string): Explain =>
  (l) => {
    const parts = [0, 1, 2].map((i) => {
      const text = t(l, `${base}.${i}`);
      return text && `${t(l, `catalogue.complexity.${i}`)}: ${text}`;
    });
    return parts.every(Boolean) ? parts.join('; ') : undefined;
  };

const count = (path: string, group: InputGroup, labelKey: string, explain?: Explain): FieldDef => ({
  path,
  group,
  labelKey,
  explain,
  type: 'count',
  min: 0,
});
const band3 = (path: string, labelKey: string, explain?: Explain): FieldDef => ({
  path,
  group: 'detail',
  labelKey,
  explain,
  type: 'band3',
  min: 0,
});
const bool = (path: string, group: InputGroup, labelKey: string, explain?: Explain): FieldDef => ({
  path,
  group,
  labelKey,
  explain,
  type: 'boolean',
});
const percent = (path: string, labelKey: string, explain?: Explain): FieldDef => ({
  path,
  group: 'evidence',
  labelKey,
  explain,
  type: 'percent',
  min: 0,
  max: 100,
});
const indexed = (base: string, n: number): [string, string][] =>
  Array.from({ length: n }, (_, i) => [String(i), `${base}.${i}`]);

const APP_DRIVERS = [
  'api',
  'screen',
  'integration',
  'rule',
  'journey',
  'batch',
  'event',
  'workflow',
];

/** Evidence fields → their row in the Shift-left evidence tab. */
const EVIDENCE: [string, string, 'percent' | 'boolean'][] = [
  ['mutation', 'mut', 'percent'],
  ['valBE', 'be', 'percent'],
  ['valFE', 'fe', 'percent'],
  ['mapCov', 'map', 'percent'],
  ['jacoco', 'jacoco', 'percent'],
  ['feUnit', 'feunit', 'percent'],
  ['feMut', 'femut', 'percent'],
  ['ruleCov', 'rule', 'percent'],
  ['iosUnit', 'ios', 'percent'],
  ['androidUnit', 'android', 'percent'],
  ['dqCov', 'dq', 'percent'],
  ['contractCov', 'contract', 'percent'],
  ['goldenReuse', 'reuse', 'percent'],
  ['evalCI', 'evalci', 'boolean'],
  ['ptCI', 'ptci', 'boolean'],
  ['ptReuse', 'ptreuse', 'percent'],
  ['apm', 'apm', 'boolean'],
];

/** Every leaf of EstimateInputs, grouped as the editor groups them (checked by a test). */
const FIELDS: FieldDef[] = [
  {
    path: 'features.*.name',
    group: 'features',
    labelKey: 'editor.rough.featureName',
    type: 'text',
  },
  {
    path: 'features.*.type',
    group: 'features',
    labelKey: 'editor.rough.type',
    type: 'enum',
    options: ['app', 'data', 'ai'].map((v) => [v, `catalogue.featureTypes.${v}`]),
  },
  {
    path: 'features.*.size',
    group: 'features',
    labelKey: 'editor.rough.size',
    type: 'enum',
    options: SIZES.map((v) => [v, undefined]),
  },
  {
    path: 'features.*.cx',
    group: 'features',
    labelKey: 'editor.rough.complexity',
    type: 'enum',
    min: 0,
    max: 2,
    options: indexed('catalogue.complexity', 3),
  },
  count('features.*.qty', 'features', 'editor.rough.quantity'),
  bool('features.*.pt', 'features', 'editor.rough.perfCriticalLong'),
  count('roughRoles', 'features', 'editor.rough.roles'),
  count('roughLanguages', 'features', 'editor.rough.languages'),
  count('roughVariants', 'features', 'editor.rough.variants'),

  ...(['web2', 'ios', 'android'] as const).map((c) =>
    bool(`channels.${c}`, 'channels', `catalogue.channels.${c}`),
  ),
  bool('a11y', 'channels', 'catalogue.channels.a11y'),

  ...APP_DRIVERS.map((d) =>
    band3(`detail.${d}`, `catalogue.drivers.${d}`, rubric(`detailTab.guide.rubric.${d}`)),
  ),
  count('detail.fields', 'detail', 'detailTab.fields.input', key('detailTab.fields.hint')),
  ...(['feed', 'pipe', 'table', 'report'] as const).map((d) =>
    band3(`detail.data.${d}`, `catalogue.dataDrivers.${d}`, rubric(`detailTab.guide.extra.${d}`)),
  ),
  // Counted by complexity since ADR-0019.
  ...(['columns', 'dq'] as const).map((d) => band3(`detail.data.${d}`, `detailTab.data.${d}`)),
  ...(['scd', 'secured', 'accessRoles'] as const).map((d) =>
    count(`detail.data.${d}`, 'detail', `detailTab.data.${d}`),
  ),
  ...(['intent', 'ocr'] as const).map((d) =>
    band3(`detail.ai.${d}`, `catalogue.aiDrivers.${d}`, rubric(`detailTab.guide.extra.${d}`)),
  ),
  ...(['rag', 'tools', 'guard', 'hitl'] as const).map((d) =>
    count(`detail.ai.${d}`, 'detail', `detailTab.ai.${d}`),
  ),
  band3('detail.pt.scen', 'detailTab.pt.scen', key('detailTab.pt.note')),
  count('detail.pt.dataHeavy', 'detail', 'detailTab.pt.dataHeavy'),
  count('detail.reqFields', 'detail', 'detailTab.fields.request'),
  count('detail.respFields', 'detail', 'detailTab.fields.response'),
  ...FIELD_TYPES.map((f) =>
    count(
      `detail.fieldTypes.${f}`,
      'detail',
      `catalogue.fieldTypes.${f}`,
      key('detailTab.fields.byTypeHint'),
    ),
  ),
  ...(['roles', 'actions', 'approvals', 'critical', 'variants'] as const).map((d) =>
    count(`detail.${d}`, 'detail', `detailTab.rules.${d}`),
  ),
  count('detail.languages', 'detail', 'detailTab.channels.languages'),

  count('team.weeks', 'team', 'teamTab.weeks'),
  ...(['junior', 'mid', 'senior'] as const).map((m) =>
    count(`team.mix.${m}`, 'team', `teamTab.${m}`),
  ),
  {
    path: 'team.env',
    group: 'team',
    labelKey: 'teamTab.env',
    type: 'enum',
    min: 0,
    max: 3,
    options: indexed('catalogue.env', 4),
  },
  {
    path: 'team.automation',
    group: 'team',
    labelKey: 'teamTab.automation',
    type: 'percent',
    min: 0,
    max: 100,
  },
  {
    path: 'team.ai',
    group: 'team',
    labelKey: 'teamTab.ai',
    type: 'enum',
    min: 0,
    max: 2,
    options: indexed('catalogue.aiLevels', 3),
  },
  { ...count('team.aiIters', 'team', 'teamTab.aiIters'), min: 1 },
  { ...count('team.aiSmes', 'team', 'teamTab.aiSmes'), min: 1 },

  ...EVIDENCE.map(([field, row, type]) =>
    type === 'percent'
      ? percent(
          `evidence.${field}`,
          `evidenceTab.rows.${row}.what`,
          key(`evidenceTab.rows.${row}.desc`),
        )
      : bool(
          `evidence.${field}`,
          'evidence',
          `evidenceTab.rows.${row}.what`,
          key(`evidenceTab.rows.${row}.desc`),
        ),
  ),
  bool('includeL4', 'evidence', 'evidenceTab.l4Label', key('evidenceTab.rows.l4.desc')),

  ...PT_TYPES.map((p) => bool(`ptTypes.${p}`, 'ptTypes', `catalogue.ptTypes.${p}`)),
];

/** The input fields of EstimateInputs with label, meaning, type and allowed range. */
export function describeInputs(opts: { locale: Locale; group?: InputGroup }): InputField[] {
  const { locale, group } = opts;
  return FIELDS.filter((f) => !group || f.group === group).map((f) => {
    const field: InputField = {
      path: f.path,
      group: f.group,
      label: t(locale, f.labelKey) ?? f.path,
      explanation: f.explain?.(locale) ?? null,
      type: f.type,
    };
    if (f.min !== undefined) field.min = f.min;
    if (f.max !== undefined) field.max = f.max;
    if (f.options) {
      field.options = f.options.map(([v, k]) => {
        const label = k && t(locale, k);
        return label ? `${v}: ${label}` : v;
      });
    }
    return field;
  });
}
