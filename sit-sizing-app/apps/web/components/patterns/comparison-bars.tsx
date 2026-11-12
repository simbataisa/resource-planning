import { cn } from '@/lib/utils';

export interface ComparisonBarsProps {
  /** Accessible description of the comparison, e.g. "API endpoints: rough 176, detailed 196 cases". */
  label: string;
  rough: number;
  detailed: number;
  /** Largest value across all rows, so bars are comparable between rows. */
  max: number;
  className?: string;
}

/** Rough vs detailed bars for the gap table (design 7). Pure CSS; the label carries the numbers. */
export function ComparisonBars({ label, rough, detailed, max, className }: ComparisonBarsProps) {
  const pct = (v: number) => `${max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0}%`;
  return (
    <div role="img" aria-label={label} className={cn('grid w-full min-w-24 gap-1', className)}>
      <span className="block h-1.5 rounded-full bg-rough" style={{ width: pct(rough) }} />
      <span className="block h-1.5 rounded-full bg-detailed" style={{ width: pct(detailed) }} />
    </div>
  );
}
