'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/patterns/empty-state';
import { PageHeader } from '@/components/patterns/page-header';
import { QueryState } from '@/components/patterns/query-state';
import { Link } from '@/i18n/navigation';
import { formatDateTime, formatFte } from '@/lib/format';
import { principalFromMe } from '@/lib/me';
import { useEstimates, useMe, useProject } from '@/lib/query/hooks';
import { can } from '@/lib/rbac';
import { MembersPanel } from '../admin/members-panel';
import { useQueryState } from '../shared/use-query-state';
import { NewEstimateDialog } from './new-estimate-dialog';

/** Estimates of one project, with "New estimate" for Estimators and QE Leads. */
export function EstimateList({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const project = useProject(projectId);
  const estimates = useEstimates(projectId);
  const me = useMe();
  const projectState = useQueryState(project);
  const listState = useQueryState(estimates);
  const canCreate = me.data ? can(principalFromMe(me.data), 'estimate.create', projectId) : false;
  const items = estimates.data?.items ?? [];

  return (
    <div className="grid gap-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('estimates.backToProjects')}
      </Link>
      <QueryState {...projectState} skeletonRows={1}>
        <PageHeader
          title={project.data?.name ?? ''}
          description={t('estimates.description', { project: project.data?.key ?? '' })}
          actions={canCreate ? <NewEstimateDialog projectId={projectId} /> : null}
        />
        <QueryState {...listState}>
          {items.length === 0 ? (
            <EmptyState
              title={t('estimates.emptyTitle')}
              description={canCreate ? t('estimates.emptyBody') : t('estimates.emptyBodyReadOnly')}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('estimates.name')}</TableHead>
                    <TableHead>{t('estimates.latest')}</TableHead>
                    <TableHead className="text-right">{t('estimates.roughFte')}</TableHead>
                    <TableHead className="text-right">{t('estimates.detailedFte')}</TableHead>
                    <TableHead>{t('estimates.updatedBy')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link
                          href={`/estimates/${e.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {e.name}
                        </Link>
                        {e.hasDraft ? (
                          <Badge variant="outline" className="ml-2">
                            {t('estimates.draft')}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {e.latest
                          ? t('estimates.versionLabel', {
                              number: e.latest.number,
                              status: t(`status.${e.latest.status}`),
                            })
                          : t('estimates.noVersion')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {e.latest ? formatFte(e.latest.roughFte) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {e.latest ? formatFte(e.latest.detailedFte) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.latest
                          ? t('estimates.byOn', {
                              name: e.latest.createdBy.displayName,
                              when: formatDateTime(e.latest.updatedAt, locale),
                            })
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
        {project.data ? (
          <MembersPanel
            key={project.data.members.map((m) => `${m.user.id}:${m.role}`).join(',')}
            project={project.data}
            canManage={
              me.data ? can(principalFromMe(me.data), 'project.members.manage', projectId) : false
            }
          />
        ) : null}
      </QueryState>
    </div>
  );
}
