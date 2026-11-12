import { cn } from '@/lib/utils';

export interface TornadoRow {
  key: string;
  label: string;
  lo: number;
  hi: number;
  /** Formatted range text, e.g. "18.1 – 25.0 FTE"; it is the accessible value of the row. */
  valueText: string;
}

export interface TornadoChartProps {
  /** Accessible name of the chart. */
  label: string;
  rows: TornadoRow[];
  /** The current value: the centre line. */
  base: number;
  className?: string;
}

/**
 * Sensitivity "tornado" (prototype renderTornado): each row shows how far the result moves
 * down (good, left) and up (bad, right) from the centre line. Bars are decorative; each row's
 * text carries the numbers, so the chart reads as a list for screen readers.
 */
export function TornadoChart({ label, rows, base, className }: TornadoChartProps) {
  let maxDev = 1e-9;
  for (const r of rows) maxDev = Math.max(maxDev, Math.abs(r.lo - base), Math.abs(r.hi - base));
  const pos = (v: number) => 50 + ((v - base) / maxDev) * 48;
  return (
    <ul aria-label={label} className={cn('grid gap-1.5', className)}>
      {rows.map((r) => {
        const lo = pos(r.lo);
        const hi = pos(r.hi);
        return (
          <li
            key={r.key}
            className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3 text-sm"
          >
            <span className="truncate" title={r.label}>
              {r.label}
            </span>
            <span aria-hidden="true" className="relative h-3 rounded-sm bg-muted">
              <span
                className="absolute inset-y-0 rounded-l-sm bg-good"
                style={{ left: `${Math.min(lo, 50)}%`, width: `${Math.max(0, 50 - lo)}%` }}
              />
              <span
                className="absolute inset-y-0 rounded-r-sm bg-bad"
                style={{ left: '50%', width: `${Math.max(0, hi - 50)}%` }}
              />
              <span className="absolute inset-y-[-2px] left-1/2 w-px bg-foreground" />
            </span>
            <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
              {r.valueText}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
