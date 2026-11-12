/** Read a dotted path such as `band.rough` or `ftypes.text` (prototype `get`). */
export function getPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k]), obj);
}

/** Write a dotted path in place (prototype `setp`). The parent objects must exist. */
export function setPath(obj: object, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const parent = keys.reduce<Record<string, unknown>>(
    (o, k) => o[k] as Record<string, unknown>,
    obj as Record<string, unknown>,
  );
  parent[last] = value;
}
