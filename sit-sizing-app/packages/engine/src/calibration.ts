import type { Assumptions } from '@sit/schemas';
import { ASSUMPTION_PATHS } from './catalogue.ts';

function get(o: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((a, k) => (a == null ? a : (a as Record<string, unknown>)[k]), o);
}

/** True when the row at `path` still equals the default (prototype isDefault). */
export function isDefaultRow(
  assumptions: Assumptions,
  defaults: Assumptions,
  path: string,
): boolean {
  return JSON.stringify(get(assumptions, path)) === JSON.stringify(get(defaults, path));
}

/** How many of the 142 assumption rows are still uncalibrated defaults. */
export function uncalibratedCount(assumptions: Assumptions, defaults: Assumptions): number {
  return ASSUMPTION_PATHS.filter((p) => isDefaultRow(assumptions, defaults, p)).length;
}
