'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import type { ProjectDetail } from '@sit/schemas';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Field } from '@/components/patterns/field';
import { ApiClientError } from '@/lib/http';
import { usePutMembers } from '@/lib/query/hooks';

type Role = 'VIEWER' | 'ESTIMATOR' | 'QE_LEAD';
const ROLES: Role[] = ['VIEWER', 'ESTIMATOR', 'QE_LEAD'];
interface Row {
  email: string;
  name: string | null;
  role: Role;
}

/**
 * Project members and roles (design 10.5, release 3 H-01), on the existing replace-all API.
 * Everyone in the project can see who is in it; QE Leads and Admins can change it. People
 * are added by work e-mail once they have signed in; at least one QE Lead must remain.
 */
export function MembersPanel({
  project,
  canManage,
}: {
  project: ProjectDetail;
  canManage: boolean;
}) {
  const t = useTranslations('admin.members');
  const tr = useTranslations('roles');
  const initial = (): Row[] =>
    project.members.map((m) => ({ email: m.user.email, name: m.user.displayName, role: m.role }));
  const [rows, setRows] = useState<Row[]>(initial);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('ESTIMATOR');
  const [problem, setProblem] = useState<string | null>(null);
  const put = usePutMembers(project.id);
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial());
  const leads = rows.filter((r) => r.role === 'QE_LEAD').length;

  function add(e: FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setProblem(t('badEmail'));
    if (rows.some((r) => r.email.toLowerCase() === v)) return setProblem(t('duplicate'));
    setProblem(null);
    setRows((rs) => [...rs, { email: v, name: null, role }]);
    setEmail('');
  }

  function save() {
    if (leads === 0) return setProblem(t('needLead'));
    setProblem(null);
    put.mutate(
      rows.map((r) => ({ email: r.email, role: r.role })),
      {
        onSuccess: (p) =>
          setRows(
            p.members.map((m) => ({
              email: m.user.email,
              name: m.user.displayName,
              role: m.role,
            })),
          ),
        onError: (err) => {
          const unknown =
            err instanceof ApiClientError && err.status === 422
              ? (err.details ?? []).map((d) => (d as { email?: string }).email).filter(Boolean)
              : [];
          setProblem(
            unknown.length ? t('notSignedIn', { emails: unknown.join(', ') }) : err.message,
          );
        },
      },
    );
  }

  return (
    <section aria-labelledby="members-title" className="grid gap-3">
      <h2 id="members-title" className="text-[1.4rem] font-light">
        {t('title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('person')}</TableHead>
              <TableHead>{t('role')}</TableHead>
              {canManage ? (
                <TableHead>
                  <span className="sr-only">{t('actions')}</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.email}>
                <TableCell>
                  <div className="font-medium">{r.name ?? t('pending')}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <NativeSelect
                      aria-label={t('roleFor', { who: r.name ?? r.email })}
                      value={r.role}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, j) => (j === i ? { ...x, role: e.target.value as Role } : x)),
                        )
                      }
                    >
                      {ROLES.map((x) => (
                        <option key={x} value={x}>
                          {tr(x)}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    tr(r.role)
                  )}
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('removeWho', { who: r.name ?? r.email })}
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {canManage ? (
        <>
          <form onSubmit={add} noValidate className="flex flex-wrap items-end gap-2">
            <Field label={t('email')}>
              {(c) => (
                <Input
                  {...c}
                  type="email"
                  autoComplete="off"
                  className="w-72"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <Field label={t('newRole')}>
              {(c) => (
                <NativeSelect {...c} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLES.map((x) => (
                    <option key={x} value={x}>
                      {tr(x)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Button type="submit" variant="outline">
              <Plus aria-hidden="true" />
              {t('add')}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">{t('hint')}</p>
          {problem ? (
            <Alert variant="destructive">
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex gap-2">
            <Button disabled={!dirty || put.isPending} onClick={save}>
              {put.isPending ? t('saving') : t('save')}
            </Button>
            {dirty ? (
              <Button variant="outline" onClick={() => setRows(initial())}>
                {t('discard')}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
