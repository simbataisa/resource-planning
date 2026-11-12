'use client';

import { useTranslations } from 'next-intl';
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
import { useMe, useProjects } from '@/lib/query/hooks';
import { useQueryState } from '../shared/use-query-state';

/** Projects the user can see (members; Admins see all). */
export function ProjectList() {
  const t = useTranslations();
  const projects = useProjects();
  const me = useMe();
  const state = useQueryState(projects);
  const items = projects.data?.items ?? [];
  const isAdmin = me.data?.globalRole === 'ADMIN';

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('projects.title')}
        description={isAdmin ? t('projects.adminDescription') : t('projects.description')}
      />
      <QueryState {...state}>
        {items.length === 0 ? (
          <EmptyState title={t('projects.emptyTitle')} description={t('projects.emptyBody')} />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('projects.key')}</TableHead>
                  <TableHead>{t('projects.name')}</TableHead>
                  <TableHead>{t('projects.myRole')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.key}</TableCell>
                    <TableCell>
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.archived ? (
                        <Badge variant="secondary" className="ml-2">
                          {t('projects.archived')}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {p.myRole ? t(`roles.${p.myRole}`) : t('projects.notMember')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
    </div>
  );
}
