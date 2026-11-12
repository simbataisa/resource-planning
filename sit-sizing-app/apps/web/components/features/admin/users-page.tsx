'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { AdminUser } from '@sit/schemas';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { formatDateTime } from '@/lib/format';
import { useMe, useSetUserActive, useUsers } from '@/lib/query/hooks';
import { useQueryState } from '../shared/use-query-state';

/**
 * Users (Admin, release 3 H-01). Identity, sign-in and the Admin role live in Keycloak
 * (ADR-0004, rule 13): the Admin role is the group sit-sizing-admins, read at every
 * sign-in. Here an Admin sees everyone who has signed in, with their project roles, and can
 * deactivate or reactivate them in this app.
 */
export function UsersPage() {
  const t = useTranslations('admin.users');
  const tr = useTranslations('roles');
  const locale = useLocale();
  const me = useMe();
  const [search, setSearch] = useState('');
  const users = useUsers(search.trim());
  const state = useQueryState(users);
  const setActive = useSetUserActive();
  const [confirm, setConfirm] = useState<string | null>(null);
  const items = users.data?.pages.flatMap((p) => p.items) ?? [];

  if (me.data && me.data.globalRole !== 'ADMIN')
    return (
      <div className="grid gap-6">
        <PageHeader title={t('title')} />
        <Alert>
          <AlertDescription>{t('forbidden')}</AlertDescription>
        </Alert>
      </div>
    );

  return (
    <div className="grid gap-6">
      <PageHeader title={t('title')} description={t('description')} />
      <Alert>
        <AlertDescription>{t('keycloakNote')}</AlertDescription>
      </Alert>
      <div className="max-w-sm">
        <Field label={t('search')}>
          {(c) => (
            <Input
              {...c}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </Field>
      </div>
      {setActive.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{setActive.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <QueryState {...state} skeletonRows={6}>
        {items.length === 0 ? (
          <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
        ) : (
          <div className="grid gap-3">
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('cols.name')}</TableHead>
                    <TableHead>{t('cols.role')}</TableHead>
                    <TableHead>{t('cols.projects')}</TableHead>
                    <TableHead>{t('cols.lastSignIn')}</TableHead>
                    <TableHead>{t('cols.status')}</TableHead>
                    <TableHead>
                      <span className="sr-only">{t('cols.actions')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((u: AdminUser) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.displayName}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        {u.globalRole === 'ADMIN' ? (
                          <Badge variant="secondary">{t('admin')}</Badge>
                        ) : (
                          t('user')
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.memberships.length
                          ? u.memberships.map((m) => `${m.projectKey} · ${tr(m.role)}`).join(', ')
                          : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt, locale) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.active ? 'good' : 'outline'}>
                          {u.active ? t('active') : t('inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {u.id === me.data?.id ? (
                          <span className="text-xs text-muted-foreground">{t('you')}</span>
                        ) : confirm === u.id ? (
                          <span className="inline-flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>
                              {t('cancel')}
                            </Button>
                            <Button
                              size="sm"
                              disabled={setActive.isPending}
                              onClick={() =>
                                setActive.mutate(
                                  { id: u.id, active: !u.active },
                                  { onSettled: () => setConfirm(null) },
                                )
                              }
                            >
                              {u.active
                                ? t('confirmDeactivate', { name: u.displayName })
                                : t('confirmActivate', { name: u.displayName })}
                            </Button>
                          </span>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setConfirm(u.id)}>
                            {u.active ? t('deactivate') : t('activate')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {users.hasNextPage ? (
              <div>
                <Button
                  variant="outline"
                  disabled={users.isFetchingNextPage}
                  onClick={() => void users.fetchNextPage()}
                >
                  {t('more')}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </QueryState>
    </div>
  );
}
