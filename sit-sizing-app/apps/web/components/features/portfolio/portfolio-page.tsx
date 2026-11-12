'use client';

import { Fragment, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import type { Portfolio, PortfolioTotals } from '@sit/schemas';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/patterns/empty-state';
import { Field } from '@/components/patterns/field';
import { PageHeader } from '@/components/patterns/page-header';
import { QueryState } from '@/components/patterns/query-state';
import { StatCard } from '@/components/patterns/stat-card';
import { Link } from '@/i18n/navigation';
import { formatFte, formatInt } from '@/lib/format';
import { principalFromMe } from '@/lib/me';
import { useMe, usePortfolio, useProjects } from '@/lib/query/hooks';
import { can } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { NAV_ICONS } from '../app-shell/nav-items';
import { SidebarNavLink } from '../app-shell/sidebar-nav-link';
import { useQueryState } from '../shared/use-query-state';

type Status = Portfolio['status'];

/**
 * The portfolio for the QBR (release 3, R-01): every estimate's approved (or newest saved)
 * version across the projects the user leads, with subtotals, the total and calibration.
 */
export function PortfolioPage() {
  const t = useTranslations('portfolio');
  const locale = useLocale();
  const me = useMe();
  const projects = useProjects();
  const [status, setStatus] = useState<Status>('approved');
  const [selected, setSelected] = useState<string[]>([]);
  const principal = me.data ? principalFromMe(me.data) : null;
  const allowed = (projects.data?.items ?? []).filter(
    (p) => !p.archived && principal && can(principal, 'portfolio.read', p.id),
  );
  const q = { status, projectIds: selected.length ? selected : undefined };
  const portfolio = usePortfolio(q);
  const state = useQueryState(portfolio);
  const p = portfolio.data;
  const csv = `/api/v1/portfolio/export?${new URLSearchParams({
    status,
    lang: locale,
    ...(selected.length ? { projectIds: selected.join(',') } : {}),
  })}`;
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const forbidden =
    me.data && principal && principal.globalRole !== 'ADMIN' && allowed.length === 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          p && !forbidden ? (
            <Button asChild variant="outline">
              <a href={csv} download>
                <Download aria-hidden="true" />
                {t('csv')}
              </a>
            </Button>
          ) : null
        }
      />
      {forbidden ? (
        <Alert>
          <AlertDescription>{t('forbidden')}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-6">
            <Field label={t('statusLabel')}>
              {(c) => (
                <NativeSelect
                  {...c}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                >
                  <option value="approved">{t('statusApproved')}</option>
                  <option value="latest">{t('statusLatest')}</option>
                </NativeSelect>
              )}
            </Field>
            {allowed.length > 1 ? (
              <fieldset className="grid gap-1.5">
                <legend className="mb-1 text-sm font-medium">{t('projects')}</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {allowed.map((pr) => (
                    <label key={pr.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={selected.includes(pr.id)}
                        onChange={() => toggle(pr.id)}
                      />
                      {pr.name}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t('projectsHint')}</p>
              </fieldset>
            ) : null}
          </div>
          <QueryState {...state} skeletonRows={4}>
            {p && p.total.estimates === 0 ? (
              <EmptyState
                title={t('emptyTitle')}
                description={status === 'approved' ? t('emptyApproved') : t('emptyLatest')}
              />
            ) : p ? (
              <>
                <Totals total={p.total} rows={p.assumptionRows} />
                <PortfolioTable p={p} />
                <p className="max-w-3xl text-xs text-muted-foreground">{t('rangeNote')}</p>
              </>
            ) : null}
          </QueryState>
        </>
      )}
    </div>
  );
}

function Totals({ total, rows }: { total: PortfolioTotals; rows: number }) {
  const t = useTranslations('portfolio');
  const calibrated = total.estimates - total.onDefaults;
  return (
    <section aria-label={t('totalsLabel')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t('cards.detailed')}
        value={total.fte}
        unit="FTE"
        tone="detailed"
        format={formatFte}
        range={t('cards.range', { lo: formatFte(total.lo), hi: formatFte(total.hi) })}
        detail={t('cards.detail', { c: formatInt(total.cases), h: formatInt(total.hours) })}
      />
      <StatCard
        label={t('cards.rough')}
        value={total.roughFte}
        unit="FTE"
        tone="rough"
        format={formatFte}
      />
      <StatCard
        label={t('cards.estimates')}
        value={total.estimates}
        format={formatInt}
        detail={t('cards.estimatesDetail')}
      />
      <StatCard
        label={t('cards.calibration')}
        value={calibrated}
        format={formatInt}
        unit={t('cards.of', { n: total.estimates })}
        tone="warn"
        detail={t('cards.calibrationDetail', { n: rows })}
      />
    </section>
  );
}

function PortfolioTable({ p }: { p: Portfolio }) {
  const t = useTranslations('portfolio');
  const ts = useTranslations('status');
  const num = 'text-right font-mono tabular-nums';
  const sums = (s: PortfolioTotals, label: string, strong = false) => (
    <TableRow className={cn(strong ? 'bg-muted font-semibold' : 'bg-muted/40 font-medium')}>
      <TableCell colSpan={4}>{label}</TableCell>
      <TableCell className={num}>{formatFte(s.fte)}</TableCell>
      <TableCell className={num}>
        {formatFte(s.lo)} – {formatFte(s.hi)}
      </TableCell>
      <TableCell className={num}>{formatInt(s.cases)}</TableCell>
      <TableCell className={num}>{formatInt(s.hours)}</TableCell>
      <TableCell className={num}>{formatFte(s.roughFte)}</TableCell>
    </TableRow>
  );
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('cols.estimate')}</TableHead>
            <TableHead>{t('cols.version')}</TableHead>
            <TableHead>{t('cols.profile')}</TableHead>
            <TableHead className="text-right">{t('cols.uncalibrated')}</TableHead>
            <TableHead className="text-right">{t('cols.fte')}</TableHead>
            <TableHead className="text-right">{t('cols.range')}</TableHead>
            <TableHead className="text-right">{t('cols.cases')}</TableHead>
            <TableHead className="text-right">{t('cols.hours')}</TableHead>
            <TableHead className="text-right">{t('cols.roughFte')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {p.projects.map((g) => (
            <Fragment key={g.projectId}>
              <TableRow>
                <TableCell colSpan={9} className="pt-4 text-sm font-semibold">
                  <span className="font-mono text-xs text-muted-foreground">{g.projectKey}</span>{' '}
                  {g.projectName}
                </TableCell>
              </TableRow>
              {g.rows.map((r) => (
                <TableRow key={r.estimateId}>
                  <TableCell>
                    <Link
                      href={`/estimates/${r.estimateId}`}
                      className="text-primary hover:underline"
                    >
                      {r.estimateName}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    v{r.versionNumber}{' '}
                    <Badge variant={r.status === 'APPROVED' ? 'good' : 'outline'}>
                      {ts(r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.profileName ?? '—'}</TableCell>
                  <TableCell className={num}>
                    {r.uncalibrated} / {p.assumptionRows}
                  </TableCell>
                  <TableCell className={num}>{formatFte(r.fte)}</TableCell>
                  <TableCell className={num}>
                    {formatFte(r.lo)} – {formatFte(r.hi)}
                  </TableCell>
                  <TableCell className={num}>{formatInt(r.cases)}</TableCell>
                  <TableCell className={num}>{formatInt(r.hours)}</TableCell>
                  <TableCell className={num}>{formatFte(r.roughFte)}</TableCell>
                </TableRow>
              ))}
              {sums(g.subtotal, t('subtotalOf', { project: g.projectName }))}
            </Fragment>
          ))}
          {sums(p.total, t('total'), true)}
        </TableBody>
      </Table>
    </div>
  );
}

/** Sidebar item, shown to QE Leads and Admins only (the API enforces it too). */
export function PortfolioNavItem({ active }: { active: boolean }) {
  const t = useTranslations('app');
  const me = useMe();
  const principal = me.data ? principalFromMe(me.data) : null;
  const show =
    principal &&
    (principal.globalRole === 'ADMIN' ||
      Object.keys(principal.memberships).some((id) => can(principal, 'portfolio.read', id)));
  return show ? (
    <SidebarNavLink
      href="/portfolio"
      label={t('portfolio')}
      icon={NAV_ICONS.portfolio}
      active={active}
    />
  ) : null;
}
