'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { useCountUp } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type StatTone = 'neutral' | 'rough' | 'detailed';

export interface StatCardProps {
  label: string;
  value: number;
  /** Shown after the number, e.g. "FTE". */
  unit?: string;
  /** Optional range line, already formatted and translated, e.g. "range 12.3 – 28.7 FTE (±40%)". */
  range?: ReactNode;
  /** Small print under the range, e.g. "3,511 cases · 3,499 h". */
  detail?: ReactNode;
  tone?: StatTone;
  /** Number formatting; defaults to one decimal. Pass a locale-aware formatter from the caller. */
  format?: (n: number) => string;
  className?: string;
}

const toneBar: Record<StatTone, string> = {
  neutral: 'bg-border',
  rough: 'bg-rough',
  detailed: 'bg-detailed',
};

const oneDecimal = (n: number) => n.toFixed(1);

/** A headline number (summary cards in design 7). The number counts up; the accessible text is the final value. */
export function StatCard({
  label,
  value,
  unit,
  range,
  detail,
  tone = 'neutral',
  format = oneDecimal,
  className,
}: StatCardProps) {
  const shown = useCountUp(value);
  return (
    <Card className={cn('relative gap-2 overflow-hidden px-5', className)}>
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', toneBar[tone])} />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">
        <span aria-hidden="true">{format(shown)}</span>
        <span className="sr-only">{format(value)}</span>
        {unit ? (
          <small className="ml-1 text-base font-normal text-muted-foreground">{unit}</small>
        ) : null}
      </p>
      {range ? <p className="text-sm">{range}</p> : null}
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </Card>
  );
}
