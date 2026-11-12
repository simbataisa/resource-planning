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
export const INPUTS_SCHEMA_VERSION = 1;

export interface StoredPayload {
  inputs: unknown;
  assumptions: unknown;
}
export type UpgradeStep = (p: StoredPayload) => StoredPayload;

/**
 * Steps keyed by the version they upgrade from. Empty: version 1 is the first stored shape.
 * Each new step ships with a fixture of the old shape and a test (AGENTS.md rule 3).
 */
export const UPGRADES: Readonly<Record<number, UpgradeStep>> = {};

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
