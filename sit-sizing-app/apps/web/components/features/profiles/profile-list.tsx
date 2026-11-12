'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Profile } from '@sit/schemas';
import { Badge } from '@/components/ui/badge';
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
import { Link } from '@/i18n/navigation';
import { formatDateTime } from '@/lib/format';
import { principalFromMe } from '@/lib/me';
import { useMe, useProfiles, useProjects } from '@/lib/query/hooks';
import { can } from '@/lib/rbac';
import { useQueryState } from '../shared/use-query-state';
import { NewProfileDialog } from './new-profile-dialog';

export const PROFILE_TONE = { DRAFT: 'outline', PUBLISHED: 'good', RETIRED: 'secondary' } as const;

/** Assumption profiles (P-01): global ones, plus the chosen project's. */
export function ProfileList() {
  const t = useTranslations('profiles');
  const locale = useLocale();
  const me = useMe();
  const projects = useProjects();
  const [projectId, setProjectId] = useState('');
  const profiles = useProfiles(projectId || undefined);
  const state = useQueryState(profiles);
  const items = profiles.data?.items ?? [];
  const principal = me.data ? principalFromMe(me.data) : null;
  const projectList = projects.data?.items ?? [];
  const manageable = principal
    ? projectList.filter((p) => can(principal, 'profile.project.manage', p.id))
    : [];
  const canGlobal = principal ? can(principal, 'profile.global.manage') : false;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          canGlobal || manageable.length ? (
            <NewProfileDialog
              canGlobal={canGlobal}
              projects={manageable}
              defaultProjectId={projectId}
            />
          ) : null
        }
      />
      <div className="max-w-sm">
        <Field label={t('showFor')}>
          {(c) => (
            <NativeSelect {...c} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{t('globalOnly')}</option>
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {t('globalAnd', { project: p.name })}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>
      <QueryState {...state}>
        {items.length === 0 ? (
          <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('scope')}</TableHead>
                  <TableHead>{t('statusLabel')}</TableHead>
                  <TableHead className="text-right">{t('uncalibratedCol')}</TableHead>
                  <TableHead>{t('published')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p: Profile) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/profiles/${p.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell>{t(`scopes.${p.scope}`)}</TableCell>
                    <TableCell>
                      <Badge variant={PROFILE_TONE[p.status]}>{t(`status.${p.status}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {p.uncalibrated} / 142
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.publishedAt ? formatDateTime(p.publishedAt, locale) : '—'}
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
