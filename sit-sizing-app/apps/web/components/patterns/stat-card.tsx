'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { useCountUp } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type StatTone = 'neutral' | 'rough' | 'detailed' | 'warn';

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

/** The prototype's summary cards: a 4px top edge and the figure in the tone's colour. */
const toneEdge: Record<StatTone, string> = {
  neutral: 'border-t-border-strong',
  rough: 'border-t-rough',
  detailed: 'border-t-detailed',
  warn: 'border-t-warn',
};
const toneFigure: Record<StatTone, string> = {
  neutral: 'text-foreground',
  rough: 'text-rough',
  detailed: 'text-detailed',
  warn: 'text-warn',
};
const toneMarker: Partial<Record<StatTone, string>> = {
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
  const marker = toneMarker[tone];
  return (
    <Card className={cn('gap-1.5 border-t-4 px-[18px] py-4', toneEdge[tone], className)}>
      <p className="flex items-center gap-2 text-[0.72rem] font-semibold tracking-[1.5px] text-muted-foreground uppercase">
        {marker ? (
          <i aria-hidden="true" className={cn('inline-block size-2.5 rounded-[2px]', marker)} />
        ) : null}
        {label}
      </p>
      <p className={cn('text-[2.3rem] leading-[1.05] font-light tabular-nums', toneFigure[tone])}>
        <span aria-hidden="true">{format(shown)}</span>
        <span className="sr-only">{format(value)}</span>
        {unit ? (
          <small className="ml-1 text-[0.95rem] font-semibold text-muted-foreground">{unit}</small>
        ) : null}
      </p>
      {range ? <p className="font-mono text-[0.86rem]">{range}</p> : null}
      {detail ? <div className="text-sm text-muted-foreground">{detail}</div> : null}
    </Card>
  );
}
