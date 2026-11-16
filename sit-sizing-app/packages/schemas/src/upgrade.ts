import { Assumptions } from './assumptions';
import { EstimateInputs } from './inputs';

/**
 * Upgrading stored payloads on read (design 6.6 rule 5; release 3 E-08).
 *
 * Every version stores `schemaVersion` with its inputs and assumptions. When the shape of
 * EstimateInputs or Assumptions changes, bump INPUTS_SCHEMA_VERSION and add one step to
 * UPGRADES that turns version N into N+1. Old rows are never rewritten in place: they are
 * upgraded each time they are read, and a version saved afterwards stores the current shape.
 */
export const INPUTS_SCHEMA_VERSION = 2;

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
 * Steps keyed by the version they upgrade from. Each step ships with a fixture of the old
 * shape and a test (AGENTS.md rule 3).
 */
export const UPGRADES: Readonly<Record<number, UpgradeStep>> = { 1: expandLegacyDataShapes };

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
