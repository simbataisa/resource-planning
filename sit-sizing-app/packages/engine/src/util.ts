/** Shared helpers. Each mirrors a prototype idiom exactly; do not "improve" them. */

export type Band = 0 | 1 | 2;
export type Triple = [number, number, number];
export const BANDS: readonly Band[] = [0, 1, 2];

/** Prototype `+x||0`: coerce to number, NaN/undefined/null → 0. */
export function num(x: unknown): number {
  return Number(x) || 0;
}

/** Prototype `sum3(a)`: a[0]+a[1]+a[2], left to right. */
export function sum3(a: Readonly<Triple>): number {
  return a[0] + a[1] + a[2];
}

/** A fresh [0,0,0]. */
export function zero3(): Triple {
  return [0, 0, 0];
}

/** Maps a triple band by band, keeping the tuple type. */
export function map3(a: Readonly<Triple>, f: (n: number, b: Band) => number): Triple {
  return [f(a[0], 0), f(a[1], 1), f(a[2], 2)];
}

/** Prototype `[0,1,2].map(f)`. */
export function bands(f: (b: Band) => number): Triple {
  return [f(0), f(1), f(2)];
}

/** Prototype `a.reduce((t,n,b)=>t+n*rate[b],0)`, same addition order. */
export function dot3(a: Readonly<Triple>, rate: Readonly<Triple>): number {
  return 0 + a[0] * rate[0] + a[1] * rate[1] + a[2] * rate[2];
}

/** Deep copy of plain data (prototype `clone`). */
export function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

/** Number that keeps `undefined` comparisons false, like the prototype's uncoerced reads. */
export function raw(x: number | undefined): number {
  return x === undefined ? Number.NaN : x;
}
