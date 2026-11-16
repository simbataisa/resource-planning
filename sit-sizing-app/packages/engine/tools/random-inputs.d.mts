export interface PrototypeLike {
  clone<T>(o: T): T;
  DEFAULTS: unknown;
  SAMPLE_SCOPE: unknown;
}
export function rng(seed: number): () => number;
export function randomCase(
  P: PrototypeLike,
  seed: number,
  sizes?: readonly string[],
): { A: any; S: any };
