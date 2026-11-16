import { DEFAULT_ASSUMPTIONS, isBuiltInSize } from '@sit/engine';
import { MAX_SIZES, SIZE_TABLES, SizeName, type Assumptions } from '@sit/schemas';

/**
 * Editing the sizes of a draft profile (ADR-0021). Pure: each helper returns new values and
 * calibration notes, or an error code, and never changes its input. A size's notes follow it
 * when it is renamed and go with it when it is removed, so the profile never keeps a note for a
 * row it no longer has.
 */
type Notes = Record<string, unknown>;
export type SizeEditError = 'BAD_NAME' | 'NAME_TAKEN' | 'LAST_SIZE' | 'TOO_MANY' | 'BUILT_IN_NAME';
export type SizeEdit = { values: Assumptions; calibration: Notes } | { error: SizeEditError };

const ROW_TABLES = ['dproxies', 'aproxies', 'proxies'] as const;
const tables = (a: Assumptions) => SIZE_TABLES.map((t) => a[t] as Record<string, unknown>);

function checkName(a: Assumptions, raw: string): string | { error: SizeEditError } {
  const r = SizeName.safeParse(raw);
  if (!r.success) return { error: 'BAD_NAME' };
  return a.sizes.includes(r.data) ? { error: 'NAME_TAKEN' } : r.data;
}

/**
 * Adds `name` at the end, as a copy of every table entry of `copyFrom`. A built-in name comes
 * back with its engine defaults instead: its rows are judged against those defaults, so a copy
 * would count as calibrated without any source (ADR-0021).
 */
export function addSize(
  values: Assumptions,
  calibration: Notes,
  name: string,
  copyFrom: string,
): SizeEdit {
  const v = structuredClone(values);
  if (v.sizes.length >= MAX_SIZES) return { error: 'TOO_MANY' };
  const n = checkName(v, name);
  if (typeof n !== 'string') return n;
  const D = tables(DEFAULT_ASSUMPTIONS as Assumptions);
  tables(v).forEach((t, i) => {
    t[n] = structuredClone(isBuiltInSize(n) ? D[i]![n] : t[copyFrom]);
  });
  v.sizes.push(n);
  return { values: v, calibration: { ...calibration } };
}

/** Renames `from` to `to` in place, moving its table entries and its notes. */
export function renameSize(
  values: Assumptions,
  calibration: Notes,
  from: string,
  to: string,
): SizeEdit {
  const v = structuredClone(values);
  const n = checkName(v, to);
  if (typeof n !== 'string') return n;
  // A renamed size keeps its values, so it cannot take a built-in name (ADR-0021).
  if (isBuiltInSize(n)) return { error: 'BUILT_IN_NAME' };
  for (const t of tables(v)) {
    t[n] = t[from];
    delete t[from];
  }
  v.sizes = v.sizes.map((s) => (s === from ? n : s));
  const notes = { ...calibration };
  for (const g of ROW_TABLES)
    if (`${g}.${from}` in notes) {
      notes[`${g}.${n}`] = notes[`${g}.${from}`];
      delete notes[`${g}.${from}`];
    }
  return { values: v, calibration: notes };
}

/** Removes `name` and its notes; a profile keeps at least one size. */
export function removeSize(values: Assumptions, calibration: Notes, name: string): SizeEdit {
  if (values.sizes.length <= 1) return { error: 'LAST_SIZE' };
  const v = structuredClone(values);
  for (const t of tables(v)) delete t[name];
  v.sizes = v.sizes.filter((s) => s !== name);
  const notes = { ...calibration };
  for (const g of ROW_TABLES) delete notes[`${g}.${name}`];
  return { values: v, calibration: notes };
}

/** Moves `name` one place up (-1) or down (1); at either end nothing moves. */
export function moveSize(
  values: Assumptions,
  calibration: Notes,
  name: string,
  dir: -1 | 1,
): SizeEdit {
  const v = structuredClone(values);
  const i = v.sizes.indexOf(name);
  const j = i + dir;
  if (i >= 0 && j >= 0 && j < v.sizes.length) [v.sizes[i], v.sizes[j]] = [v.sizes[j]!, v.sizes[i]!];
  return { values: v, calibration: { ...calibration } };
}
