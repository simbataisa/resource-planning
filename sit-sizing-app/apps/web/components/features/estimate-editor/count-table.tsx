'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NumberInput } from '@/components/patterns/number-input';
import { formatInt } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface CountRow {
  key: string;
  label: string;
  values: readonly [number, number, number];
  onChange: (band: 0 | 1 | 2, value: number) => void;
  /** Extra cells after Total, e.g. "Rough said". */
  extra?: ReactNode;
  dimmed?: boolean;
}

/** Simple / Medium / Complex counts per driver with a total (prototype `countTable`). */
export function CountTable({
  rows,
  normalize,
  disabled,
  extraHeader,
}: {
  rows: CountRow[];
  normalize: (n: number) => number;
  disabled?: boolean;
  extraHeader?: string;
}) {
  const t = useTranslations('detailTab.app');
  const tc = useTranslations('catalogue.complexity');
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('driver')}</TableHead>
            {[0, 1, 2].map((b) => (
              <TableHead key={b} className="text-right">
                {tc(String(b))}
              </TableHead>
            ))}
            <TableHead className="text-right">{t('total')}</TableHead>
            {extraHeader ? <TableHead className="text-right">{extraHeader}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key} className={cn(r.dimmed && 'opacity-45')}>
              <TableCell>{r.label}</TableCell>
              {([0, 1, 2] as const).map((b) => (
                <TableCell key={b} className="text-right">
                  <NumberInput
                    aria-label={t('cellLabel', { driver: r.label, band: tc(String(b)) })}
                    value={r.values[b]}
                    min={0}
                    normalize={normalize}
                    disabled={disabled}
                    className="ml-auto w-20"
                    onValueChange={(v) => r.onChange(b, v)}
                  />
                </TableCell>
              ))}
              <TableCell className="text-right font-medium tabular-nums">
                {formatInt(r.values[0] + r.values[1] + r.values[2])}
              </TableCell>
              {r.extra}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
