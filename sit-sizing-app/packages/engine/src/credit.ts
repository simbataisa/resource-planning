/** Shift-left credit state from a coverage percentage (prototype `credit()`). */
export type Credit = 'sample' | 'partial' | 'full';

/** ≥100% → SIT keeps a sample · 50–99% → part comes back · <50% → SIT tests in full. */
export function credit(coverage: number): Credit {
  return coverage >= 100 ? 'sample' : coverage >= 50 ? 'partial' : 'full';
}

/** Applies a credit state to a full-scope value (prototype `cr()` in the data block). */
export function applyCredit(
  state: Credit,
  full: number,
  sample: number,
  partialShare: number,
): number {
  return state === 'sample' ? sample : state === 'partial' ? full * partialShare : full;
}
