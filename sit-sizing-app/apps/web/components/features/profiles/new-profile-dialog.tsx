'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Field } from '@/components/patterns/field';
import { useRouter } from '@/i18n/navigation';
import { useCreateProfile, useProfiles } from '@/lib/query/hooks';

/**
 * Creates a draft profile (P-01), blank or cloned. `clone` opens it pre-set to copy one
 * profile (the "Clone" action on a profile page).
 */
export function NewProfileDialog({
  canGlobal,
  projects,
  defaultProjectId = '',
  clone,
}: {
  canGlobal: boolean;
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
  clone?: { id: string; name: string; projectId: string | null };
}) {
  const t = useTranslations('profiles');
  const tc = useTranslations('common');
  const router = useRouter();
  const create = useCreateProfile();
  const [open, setOpen] = useState(false);
  const firstScope = clone?.projectId ?? (defaultProjectId || (canGlobal ? '' : projects[0]?.id));
  const [target, setTarget] = useState(firstScope ?? '');
  const [name, setName] = useState(clone ? t('copyOf', { name: clone.name }) : '');
  const [basedOnId, setBasedOnId] = useState(clone?.id ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  // Sources: global profiles plus the target project's.
  const sources = useProfiles(target || undefined);
  const options = (sources.data?.items ?? []).filter(
    (p) => p.scope === 'GLOBAL' || p.projectId === target,
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setNameError(t('nameRequired'));
    create.mutate(
      {
        name: name.trim(),
        scope: target ? 'PROJECT' : 'GLOBAL',
        projectId: target || undefined,
        basedOnId: basedOnId || undefined,
      },
      { onSuccess: (p) => router.push(`/profiles/${p.id}`) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {clone ? (
          <Button variant="outline">
            <Copy aria-hidden="true" />
            {t('clone')}
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden="true" />
            {t('new')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{clone ? t('cloneTitle') : t('newTitle')}</DialogTitle>
            <DialogDescription>{t('newDescription')}</DialogDescription>
          </DialogHeader>
          <Field label={t('name')} error={nameError}>
            {(c) => (
              <Input
                {...c}
                value={name}
                maxLength={120}
                autoComplete="off"
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(undefined);
                }}
              />
            )}
          </Field>
          <Field label={t('scope')}>
            {(c) => (
              <NativeSelect {...c} value={target} onChange={(e) => setTarget(e.target.value)}>
                {canGlobal ? <option value="">{t('scopes.GLOBAL')}</option> : null}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t('projectScope', { project: p.name })}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label={t('basedOn')}>
            {(c) => (
              <NativeSelect {...c} value={basedOnId} onChange={(e) => setBasedOnId(e.target.value)}>
                <option value="">{t('engineDefaults')}</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {t(`status.${p.status}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          {create.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{create.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
