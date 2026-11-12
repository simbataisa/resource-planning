/**
 * Field-level differences between two JSON documents (version compare, V-01). Leaves are
 * compared by value; arrays of numbers (Simple/Medium/Complex) are compared as one value so
 * "[4,6,10] → [5,7,11]" reads as one change.
 */
export interface Change {
  path: string;
  a: unknown;
  b: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const isLeafArray = (v: unknown) =>
  Array.isArray(v) && v.every((x) => !isObject(x) && !Array.isArray(x));

export function diffJson(a: unknown, b: unknown, path = ''): Change[] {
  if (isObject(a) && isObject(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return keys.flatMap((k) => diffJson(a[k], b[k], path ? `${path}.${k}` : k));
  }
  if (Array.isArray(a) && Array.isArray(b) && !(isLeafArray(a) && isLeafArray(b))) {
    const n = Math.max(a.length, b.length);
    return Array.from({ length: n }, (_, i) => diffJson(a[i], b[i], `${path}[${i}]`)).flat();
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [{ path, a: a ?? null, b: b ?? null }];
}
