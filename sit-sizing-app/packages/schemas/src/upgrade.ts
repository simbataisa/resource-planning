import { Assumptions } from './assumptions';
import { SIZES } from './common';
import { EstimateInputs } from './inputs';

/**
 * Upgrading stored payloads on read (design 6.6 rule 5; release 3 E-08).
 *
 * Every version stores `schemaVersion` with its inputs and assumptions. When the shape of
 * EstimateInputs or Assumptions changes, bump INPUTS_SCHEMA_VERSION and add one step to
 * UPGRADES that turns version N into N+1. Old rows are never rewritten in place: they are
 * upgraded each time they are read, and a version saved afterwards stores the current shape.
 */
export const INPUTS_SCHEMA_VERSION = 4;

export interface StoredPayload {
  inputs: unknown;
  assumptions: unknown;
}
export type UpgradeStep = (p: StoredPayload) => StoredPayload;

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';

/**
 * Version 1 → 2 (ADR-0019). Data-test design and execution minutes and preparation hours
 * became Simple/Medium/Complex sizes: an old single value is copied to every size, so the
 * numbers do not change. Mapped columns and DQ rules became counts by complexity: an old
 * count is Simple, where the engine used to put it. Values already in the new shape are left
 * alone, so the step is safe to run twice. Also used for prototype JSON files.
 */
export function expandLegacyDataShapes(p: StoredPayload): StoredPayload {
  const a = p.assumptions;
  if (isObj(a))
    for (const k of ['dataDesign', 'dataExec', 'dataPrepHours'] as const) {
      const v = a[k];
      if (typeof v === 'number') a[k] = [v, v, v];
    }
  const detail = isObj(p.inputs) ? p.inputs.detail : undefined;
  const data = isObj(detail) ? detail.data : undefined;
  if (isObj(data))
    for (const k of ['columns', 'dq'] as const) {
      const n = data[k];
      if (typeof n === 'number') data[k] = [n, 0, 0];
    }
  return p;
}

/**
 * Defaults for the sizes added in schema version 3 (ADR-0020). The engine's DEFAULT_ASSUMPTIONS
 * holds the same values; an engine test checks they agree.
 */
export const NEW_FEATURE_SIZE_DEFAULTS = {
  proxies: {
    XXS: {
      screen: 0,
      field: 2,
      api: 1,
      integration: 0,
      rule: 1,
      journey: 0,
      batch: 0,
      event: 0,
      workflow: 0,
      actions: 0,
    },
    XS: {
      screen: 1,
      field: 3,
      api: 1,
      integration: 0,
      rule: 1,
      journey: 1,
      batch: 0,
      event: 0,
      workflow: 0,
      actions: 1,
    },
    'M-': {
      screen: 2,
      field: 11,
      api: 3,
      integration: 1,
      rule: 4,
      journey: 1,
      batch: 1,
      event: 1,
      workflow: 1,
      actions: 2,
    },
    'M+': {
      screen: 3,
      field: 23,
      api: 6,
      integration: 2,
      rule: 8,
      journey: 2,
      batch: 1,
      event: 2,
      workflow: 1,
      actions: 3,
    },
    XXL: {
      screen: 13,
      field: 99,
      api: 25,
      integration: 5,
      rule: 32,
      journey: 5,
      batch: 4,
      event: 7,
      workflow: 4,
      actions: 9,
    },
    XXXL: {
      screen: 23,
      field: 178,
      api: 45,
      integration: 10,
      rule: 58,
      journey: 10,
      batch: 6,
      event: 13,
      workflow: 6,
      actions: 16,
    },
  },
  dproxies: {
    XXS: { feed: 0, pipe: 0, table: 1, report: 0, columns: 10, dq: 2, scd: 0, secured: 0 },
    XS: { feed: 1, pipe: 1, table: 2, report: 1, columns: 20, dq: 3, scd: 0, secured: 1 },
    'M-': { feed: 2, pipe: 2, table: 6, report: 2, columns: 80, dq: 13, scd: 1, secured: 2 },
    'M+': { feed: 3, pipe: 5, table: 12, report: 3, columns: 190, dq: 30, scd: 2, secured: 4 },
    XXL: { feed: 13, pipe: 18, table: 50, report: 14, columns: 864, dq: 144, scd: 9, secured: 14 },
    XXXL: {
      feed: 23,
      pipe: 32,
      table: 91,
      report: 26,
      columns: 1555,
      dq: 259,
      scd: 16,
      secured: 26,
    },
  },
  aproxies: {
    XXS: { intent: 1, ocr: 0, rag: 0, tools: 0, guard: 1, hitl: 0 },
    XS: { intent: 2, ocr: 0, rag: 1, tools: 1, guard: 2, hitl: 1 },
    'M-': { intent: 6, ocr: 1, rag: 2, tools: 2, guard: 5, hitl: 2 },
    'M+': { intent: 12, ocr: 2, rag: 4, tools: 4, guard: 6, hitl: 3 },
    XXL: { intent: 45, ocr: 7, rag: 14, tools: 14, guard: 14, hitl: 7 },
    XXXL: { intent: 81, ocr: 13, rag: 26, tools: 26, guard: 26, hitl: 13 },
  },
  ptRoughScen: { XXS: 1, XS: 1, 'M-': 2, 'M+': 3, XXL: 8, XXXL: 13 },
} as const;

/**
 * Version 2 → 3 (ADR-0020). Rough-scope sizes grew from S, M, L, XL to ten sizes: the new sizes
 * are added at their defaults to each proxy group and to the performance scenarios. Existing
 * sizes keep their values and a size already present is never overwritten (safe to run twice).
 */
export function addFeatureSizes(p: StoredPayload): StoredPayload {
  const a = p.assumptions;
  if (isObj(a))
    for (const [group, sizes] of Object.entries(NEW_FEATURE_SIZE_DEFAULTS)) {
      const g = a[group];
      if (!isObj(g)) continue;
      for (const [size, value] of Object.entries(sizes))
        if (!(size in g)) g[size] = structuredClone(value as unknown);
    }
  return p;
}

/**
 * Version 3 → 4 (ADR-0021). Sizes became data: the assumptions carry an ordered `sizes` list
 * and `sizeNotes`. Stored tables only hold built-in sizes, and jsonb does not keep key order,
 * so the list is the built-in names present in `proxies`, in built-in order. A payload that
 * already has a list is left alone.
 */
export function addSizeList(p: StoredPayload): StoredPayload {
  const a = p.assumptions;
  if (isObj(a) && !Array.isArray(a.sizes)) {
    const proxies = isObj(a.proxies) ? a.proxies : {};
    a.sizes = SIZES.filter((s) => s in proxies);
    if (!isObj(a.sizeNotes)) a.sizeNotes = {};
  }
  return p;
}

/**
 * Steps keyed by the version they upgrade from. Each step ships with a fixture of the old
 * shape and a test (AGENTS.md rule 3).
 */
export const UPGRADES: Readonly<Record<number, UpgradeStep>> = {
  1: expandLegacyDataShapes,
  2: addFeatureSizes,
  3: addSizeList,
};

export class StoredPayloadError extends Error {
  readonly code: 'NEWER_THAN_APP' | 'NO_UPGRADE' | 'INVALID';
  constructor(code: StoredPayloadError['code'], message: string) {
    super(message);
    this.name = 'StoredPayloadError';
    this.code = code;
  }
}

/**
 * The stored inputs and assumptions in the current shape, validated. `upgradedFrom` is the
 * stored schema version when one or more steps ran, otherwise null.
 */
export function upgradeStored(
  schemaVersion: number,
  payload: StoredPayload,
  steps: Readonly<Record<number, UpgradeStep>> = UPGRADES,
  current: number = INPUTS_SCHEMA_VERSION,
): { inputs: EstimateInputs; assumptions: Assumptions; upgradedFrom: number | null } {
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1)
    throw new StoredPayloadError('INVALID', `Unknown schema version ${schemaVersion}.`);
  if (schemaVersion > current)
    throw new StoredPayloadError(
      'NEWER_THAN_APP',
      `Saved with schema version ${schemaVersion}; this app reads up to ${current}.`,
    );
  let p = payload;
  for (let v = schemaVersion; v < current; v++) {
    const step = steps[v];
    if (!step)
      throw new StoredPayloadError(
        'NO_UPGRADE',
        `No upgrade from schema version ${v} to ${v + 1}.`,
      );
    p = step(structuredClone(p));
  }
  const inputs = EstimateInputs.safeParse(p.inputs);
  const assumptions = Assumptions.safeParse(p.assumptions);
  if (!inputs.success || !assumptions.success)
    throw new StoredPayloadError(
      'INVALID',
      'The stored inputs or assumptions do not match the schema.',
    );
  return {
    inputs: inputs.data,
    assumptions: assumptions.data,
    upgradedFrom: schemaVersion < current ? schemaVersion : null,
  };
}
