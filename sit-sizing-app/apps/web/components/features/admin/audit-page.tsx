'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/patterns/empty-state';
import { Field } from '@/components/patterns/field';
import { PageHeader } from '@/components/patterns/page-header';
import { QueryState } from '@/components/patterns/query-state';
import { formatDateTime } from '@/lib/format';
import { principalFromMe } from '@/lib/me';
import { useAudit, useMe, useProjects } from '@/lib/query/hooks';
import { can } from '@/lib/rbac';
import { useQueryState } from '../shared/use-query-state';

/** Action filters offered in the list; the API also takes any exact action. */
const ACTIONS = [
  'estimate.',
  'estimate.version.',
  'estimate.draft.',
  'profile.',
  'actuals.',
  'project.',
  'user.',
] as const;

/**
 * The audit log (design 10.6, release 3 H-01): who did what, when, newest first. QE Leads see
 * the projects they lead; Admins can also see everything, including global events.
 */
export function AuditPage() {
  const t = useTranslations('audit');
  const me = useMe();
  const projects = useProjects();
  const principal = me.data ? principalFromMe(me.data) : null;
  const isAdmin = principal?.globalRole === 'ADMIN';
  const led = (projects.data?.items ?? []).filter(
    (p) => principal && can(principal, 'audit.read.project', p.id),
  );
  const [projectId, setProjectId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Leads must pick one of their projects; default to the first.
  const effectiveProject = projectId || (isAdmin ? '' : (led[0]?.id ?? ''));
  const forbidden = me.data && !isAdmin && projects.data && led.length === 0;

  return (
    <div className="grid gap-6">
      <PageHeader title={t('title')} description={t('description')} />
      {forbidden ? (
        <Alert>
          <AlertDescription>{t('forbidden')}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('project')}>
              {(c) => (
                <NativeSelect
                  {...c}
                  value={effectiveProject}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  {isAdmin ? <option value="">{t('allProjects')}</option> : null}
                  {(isAdmin ? (projects.data?.items ?? []) : led).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label={t('action')}>
              {(c) => (
                <NativeSelect {...c} value={action} onChange={(e) => setAction(e.target.value)}>
                  <option value="">{t('anyAction')}</option>
                  {ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {t(`actions.${a.slice(0, -1).replace('.', '_')}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label={t('from')}>
              {(c) => (
                <Input {...c} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              )}
            </Field>
            <Field label={t('to')}>
              {(c) => (
                <Input {...c} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              )}
            </Field>
          </div>
          {me.data && projects.data ? (
            <AuditTable
              q={{
                projectId: effectiveProject || undefined,
                action: action || undefined,
                from: from || undefined,
                to: to || undefined,
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function AuditTable({ q }: { q: Record<string, string | undefined> }) {
  const t = useTranslations('audit');
  const locale = useLocale();
  const audit = useAudit(q);
  const state = useQueryState(audit);
  const items = audit.data?.pages.flatMap((p) => p.items) ?? [];
  const detail = (d: Record<string, unknown>) => {
    const s = JSON.stringify(d);
    return s === '{}' ? '' : s.length > 160 ? `${s.slice(0, 157)}…` : s;
  };
  return (
    <QueryState {...state} skeletonRows={6}>
      {items.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
      ) : (
        <div className="grid gap-3">
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('cols.when')}</TableHead>
                  <TableHead>{t('cols.who')}</TableHead>
                  <TableHead>{t('cols.action')}</TableHead>
                  <TableHead>{t('cols.project')}</TableHead>
                  <TableHead>{t('cols.detail')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(e.at, locale)}
                    </TableCell>
                    <TableCell>{e.actor.displayName}</TableCell>
                    <TableCell className="font-mono text-xs">{e.action}</TableCell>
                    <TableCell>{e.project ? e.project.key : '—'}</TableCell>
                    <TableCell className="max-w-md font-mono text-xs break-all text-muted-foreground">
                      {detail(e.detail)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {audit.hasNextPage ? (
            <div>
              <Button
                variant="outline"
                disabled={audit.isFetchingNextPage}
                onClick={() => void audit.fetchNextPage()}
              >
                {t('more')}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </QueryState>
  );
}
