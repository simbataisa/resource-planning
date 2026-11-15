/** A change names a path that does not exist in the object it is applied to. */
export class PathError extends Error {
  readonly path: string;

  constructor(path: string, reason = 'does not exist') {
    super(`Path '${path}' ${reason}.`);
    this.name = 'PathError';
    this.path = path;
  }
}

const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);

function has(node: unknown, key: string): boolean {
  if (FORBIDDEN.has(key)) return false;
  if (Array.isArray(node)) return /^\d+$/.test(key) && Number(key) < node.length;
  return node !== null && typeof node === 'object' && Object.hasOwn(node, key);
}

/**
 * Applies `{ path, value }` changes to a copy of `base` and returns the copy. Paths are
 * dotted, with array indexes as segments (`features.0.qty`). Every path must already exist:
 * a change replaces a value, it never adds a key or an array element (replace the whole
 * array to add one). Pure: `base` is not changed.
 */
export function applyChanges<T>(base: T, changes: readonly { path: string; value: unknown }[]): T {
  const copy = structuredClone(base);
  for (const { path, value } of changes) {
    const keys = path.split('.');
    let node: unknown = copy;
    for (const [i, key] of keys.entries()) {
      if (!has(node, key)) throw new PathError(path);
      if (i === keys.length - 1) (node as Record<string, unknown>)[key] = structuredClone(value);
      else node = (node as Record<string, unknown>)[key];
    }
  }
  return copy;
}
