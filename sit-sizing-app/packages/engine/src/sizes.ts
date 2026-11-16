import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { SIZE_ROW_TABLES, SIZES } from './catalogue.ts';

/**
 * Feature sizes are data (ADR-0021): a profile can add, rename and remove them. These helpers
 * answer the questions the server asks about them.
 */
const BUILT_IN: ReadonlySet<string> = new Set(SIZES);

/** True for the ten built-in names, whose rows are judged against the engine defaults. */
export function isBuiltInSize(name: string): boolean {
  return BUILT_IN.has(name);
}

/** The rows of the custom (not built-in) sizes, which count as calibrated only with a note. */
export function customSizePaths(a: { readonly sizes: readonly string[] }): string[] {
  const custom = a.sizes.filter((s) => !isBuiltInSize(s));
  return SIZE_ROW_TABLES.flatMap((t) => custom.map((s) => `${t}.${s}`));
}

/** Sizes used by rough-scope features but missing from the assumptions, with feature counts. */
export function unknownFeatureSizes(
  inputs: Pick<EstimateInputs, 'features'>,
  a: { readonly sizes: readonly string[] },
): { size: string; features: number }[] {
  const known = new Set(a.sizes);
  const missing = new Map<string, number>();
  for (const f of inputs.features)
    if (!known.has(f.size)) missing.set(f.size, (missing.get(f.size) ?? 0) + 1);
  return [...missing].map(([size, features]) => ({ size, features }));
}

const TABLES = ['proxies', 'dproxies', 'aproxies', 'ptRoughScen'] as const;
const keySet = (o: object) => Object.keys(o).sort().join('\u0000');

/** True when both have the same sizes in the same order and the same keys in every table. */
export function sameSizeSet(a: Assumptions, b: Assumptions): boolean {
  return (
    a.sizes.length === b.sizes.length &&
    a.sizes.every((s, i) => s === b.sizes[i]) &&
    TABLES.every((t) => keySet(a[t]) === keySet(b[t]))
  );
}
