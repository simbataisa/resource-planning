import type { Assumptions } from '@sit/schemas';
import { assumptionPaths } from './catalogue.ts';
import { isBuiltInSize } from './sizes.ts';

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

const pick = (o: unknown, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, (o as Record<string, unknown> | undefined)?.[k]]));

/**
 * True while one assumption row is uncalibrated (ADR-0021):
 * - a fixed row, or a row of a built-in size, while it equals the engine default;
 * - a row of a custom size until `notes` (by default the copied `sizeNotes`) has an entry for it;
 * - `ptRoughScen` is one row, judged by its built-in sizes only.
 */
export function isUncalibratedRow(
  assumptions: Assumptions,
  defaults: Assumptions,
  path: string,
  notes: Readonly<Record<string, unknown>> = assumptions.sizeNotes ?? {},
): boolean {
  if (path === 'ptRoughScen') {
    const builtIn = Object.keys(assumptions.ptRoughScen).filter(isBuiltInSize);
    return (
      canonical(pick(assumptions.ptRoughScen, builtIn)) ===
      canonical(pick(defaults.ptRoughScen, builtIn))
    );
  }
  const size = /^(d|a)?proxies\./.test(path) ? path.slice(path.indexOf('.') + 1) : null;
  if (size !== null && !isBuiltInSize(size)) return !(path in notes);
  return isDefaultRow(assumptions, defaults, path);
}

/** How many of the estimate's rows (130 fixed plus 3 per size) are uncalibrated (ADR-0021). */
export function uncalibratedCount(
  assumptions: Assumptions,
  defaults: Assumptions,
  notes: Readonly<Record<string, unknown>> = assumptions.sizeNotes ?? {},
): number {
  return assumptionPaths(assumptions).filter((p) =>
    isUncalibratedRow(assumptions, defaults, p, notes),
  ).length;
}
