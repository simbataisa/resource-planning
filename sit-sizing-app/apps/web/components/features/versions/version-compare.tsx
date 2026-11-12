'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/patterns/page-header';
import { QueryState } from '@/components/patterns/query-state';
import { Link } from '@/i18n/navigation';
import { formatFte, formatInt, signed } from '@/lib/format';
import { useCompare } from '@/lib/query/hooks';
import { cn } from '@/lib/utils';
import { useQueryState } from '../shared/use-query-state';

const show = (v: unknown, empty: string) =>
  v === null || v === undefined ? empty : typeof v === 'object' ? JSON.stringify(v) : String(v);

/** Two versions side by side (release 2, V-01): results, groups and changed values. */
export function VersionComparePage({
  estimateId,
  a,
  b,
}: {
  estimateId: string;
  a: number;
  b: number;
}) {
  const t = useTranslations('versions.cmp');
  const tg = useTranslations('catalogue.groups');
  const q = useCompare(estimateId, a, b);
  const state = useQueryState(q);
  const d = q.data;
  const tone = (n: number) => (n > 0 ? 'text-bad' : n < 0 ? 'text-good' : '');

  return (
    <div className="grid gap-6">
      <Link
        href={`/estimates/${estimateId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('back')}
      </Link>
      <PageHeader title={t('title', { a, b })} />
      <QueryState {...state} skeletonRows={6}>
        {d ? (
          <>
            <section className="grid gap-2">
              <h2 className="text-base font-semibold">{t('results')}</h2>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('mode')}</TableHead>
                      <TableHead>{t('measure')}</TableHead>
                      <TableHead className="text-right">v{a}</TableHead>
                      <TableHead className="text-right">v{b}</TableHead>
                      <TableHead className="text-right">{t('delta')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(['rough', 'detailed'] as const).flatMap((m) =>
                      (['fte', 'cases', 'hours'] as const).map((k) => {
                        const fa = d.results[m].a[k];
                        const fb = d.results[m].b[k];
                        const f = k === 'fte' ? formatFte : formatInt;
                        return (
                          <TableRow key={`${m}-${k}`}>
                            <TableCell>{t(m)}</TableCell>
                            <TableCell>{t(k)}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {f(fa)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {f(fb)}
                            </TableCell>
                            <TableCell
                              className={cn('text-right font-mono tabular-nums', tone(fb - fa))}
                            >
                              {signed(fb - fa, f)}
                            </TableCell>
                          </TableRow>
                        );
                      }),
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
            <section className="grid gap-2">
              <h2 className="text-base font-semibold">{t('groups')}</h2>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('group')}</TableHead>
                      <TableHead className="text-right">v{a}</TableHead>
                      <TableHead className="text-right">v{b}</TableHead>
                      <TableHead className="text-right">{t('delta')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.groups.map((g) => (
                      <TableRow key={g.group}>
                        <TableCell>{tg(g.group)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatInt(g.aCases)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatInt(g.bCases)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono tabular-nums',
                            tone(g.bCases - g.aCases),
                          )}
                        >
                          {signed(g.bCases - g.aCases, formatInt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
            <section className="grid gap-2">
              <h2 className="text-base font-semibold">{t('changes')}</h2>
              {d.changes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('none')}</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('area')}</TableHead>
                        <TableHead>{t('path')}</TableHead>
                        <TableHead>v{a}</TableHead>
                        <TableHead>v{b}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.changes.map((c) => (
                        <TableRow key={`${c.area}:${c.path}`}>
                          <TableCell>{t(c.area)}</TableCell>
                          <TableCell className="font-mono text-xs">{c.path}</TableCell>
                          <TableCell className="font-mono text-xs break-all">
                            {show(c.a, t('empty'))}
                          </TableCell>
                          <TableCell className="font-mono text-xs break-all">
                            {show(c.b, t('empty'))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {d.truncated ? (
                <p className="text-xs text-muted-foreground">{t('truncated')}</p>
              ) : null}
            </section>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
