import { StoredPayloadError, upgradeStored } from '@sit/schemas';
import { HttpError } from './http/route';
import { logger } from './logger';

/**
 * Every read of a version's inputs and assumptions goes through here (design 6.6 rule 5,
 * release 3 E-08): the payload is upgraded from its stored schema version and validated.
 * Rows are never rewritten in place; a version saved afterwards stores the current shape.
 */
export function readStored(v: {
  id?: string;
  schemaVersion: number;
  inputs: unknown;
  assumptions: unknown;
}) {
  try {
    return upgradeStored(v.schemaVersion, v);
  } catch (err) {
    if (!(err instanceof StoredPayloadError)) throw err;
    if (err.code === 'NEWER_THAN_APP')
      // Data written by a newer release, read after a rollback (runbook section 8).
      throw new HttpError(
        409,
        'CONFLICT',
        'This version was saved by a newer release of the app. Use the newer release to open it.',
        [{ reason: 'NEWER_SCHEMA' }],
      );
    logger.error({ versionId: v.id, code: err.code }, 'stored payload cannot be read');
    throw new HttpError(500, 'INTERNAL', 'This version cannot be read.');
  }
}
