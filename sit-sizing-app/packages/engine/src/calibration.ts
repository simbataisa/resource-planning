import type { Assumptions } from '@sit/schemas';
import { ASSUMPTION_PATHS } from './catalogue.ts';

function get(o: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((a, k) => (a == null ? a : (a as Record<string, unknown>)[k]), o);
}

/**
 * JSON with object keys sorted, so equality does not depend on key order. Values read back
 * from Postgres jsonb come with their keys reordered (shorter keys first).
 */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object')
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(v);
}

/** True when the row at `path` still equals the default (prototype isDefault), in any key order. */
export function isDefaultRow(
  assumptions: Assumptions,
  defaults: Assumptions,
  path: string,
): boolean {
  return canonical(get(assumptions, path)) === canonical(get(defaults, path));
}

/** How many of the 142 assumption rows are still uncalibrated defaults. */
export function uncalibratedCount(assumptions: Assumptions, defaults: Assumptions): number {
  return ASSUMPTION_PATHS.filter((p) => isDefaultRow(assumptions, defaults, p)).length;
}
