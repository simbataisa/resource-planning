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
 * How many assumption rows are still uncalibrated (ADR-0021):
 * - a fixed row, or a row of a built-in size, while it equals the engine default;
 * - a row of a custom size until `notes` (by default the copied `sizeNotes`) has an entry for it;
 * - `ptRoughScen` is one row, judged by its built-in sizes only.
 * Rows of a removed size are absent, so they count neither way.
 */
export function uncalibratedCount(
  assumptions: Assumptions,
  defaults: Assumptions,
  notes: Readonly<Record<string, unknown>> = assumptions.sizeNotes ?? {},
): number {
  return assumptionPaths(assumptions).filter((p) => {
    if (p === 'ptRoughScen') {
      const builtIn = Object.keys(assumptions.ptRoughScen).filter(isBuiltInSize);
      return (
        canonical(pick(assumptions.ptRoughScen, builtIn)) ===
        canonical(pick(defaults.ptRoughScen, builtIn))
      );
    }
    const size = p.includes('.') && /^(d|a)?proxies\./.test(p) ? p.slice(p.indexOf('.') + 1) : null;
    if (size !== null && !isBuiltInSize(size)) return !(p in notes);
    return isDefaultRow(assumptions, defaults, p);
  }).length;
}
