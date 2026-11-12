'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/patterns/field';
import { useRouter } from '@/i18n/navigation';
import { useCreateEstimate } from '@/lib/query/hooks';

type Template = 'example' | 'blank';

/** Creates an estimate from the worked example or a blank scope, then opens it. */
export function NewEstimateDialog({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const create = useCreateEstimate(projectId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState<Template>('example');
  const [nameError, setNameError] = useState<string | undefined>();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === '') {
      setNameError(t('estimates.nameRequired'));
      return;
    }
    create.mutate(
      { name: name.trim(), description: description.trim() || undefined, template },
      { onSuccess: (estimate) => router.push(`/estimates/${estimate.id}`) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          {t('estimates.new')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('common.close')}>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('estimates.newTitle')}</DialogTitle>
            <DialogDescription>{t('estimates.newDescription')}</DialogDescription>
          </DialogHeader>
          <Field
            label={t('estimates.fieldName')}
            hint={t('estimates.fieldNameHint')}
            error={nameError}
          >
            {(control) => (
              <Input
                {...control}
                value={name}
                maxLength={160}
                autoComplete="off"
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(undefined);
                }}
              />
            )}
          </Field>
          <Field label={t('estimates.fieldDescription')}>
            {(control) => (
              <Textarea
                {...control}
                value={description}
                maxLength={2000}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t('estimates.fieldTemplate')}</legend>
            {(['example', 'blank'] as const).map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
              >
                <input
                  type="radio"
                  name="template"
                  value={value}
                  checked={template === value}
                  onChange={() => setTemplate(value)}
                  className="mt-1 accent-primary"
                />
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">
                    {t(
                      value === 'example' ? 'estimates.templateExample' : 'estimates.templateBlank',
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(
                      value === 'example'
                        ? 'estimates.templateExampleHint'
                        : 'estimates.templateBlankHint',
                    )}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {create.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{t('common.errorTitle')}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t('estimates.creating') : t('estimates.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
