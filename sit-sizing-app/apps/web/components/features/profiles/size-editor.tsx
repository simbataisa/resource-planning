'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Assumptions } from '@sit/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Field } from '@/components/patterns/field';
import {
  addSize,
  moveSize,
  removeSize,
  renameSize,
  type SizeEdit,
  type SizeEditError,
} from '@/lib/profile-sizes';

type Notes = Record<string, unknown>;

/**
 * The feature sizes of a profile (ADR-0021): their order is the order the rough-scope picker
 * offers. A draft can add (as a copy of another size), rename, move and remove sizes; anything
 * else shows them read-only.
 */
export function SizeEditor({
  values,
  calibration,
  editable,
  onChange,
}: {
  values: Assumptions;
  calibration: Notes;
  editable: boolean;
  onChange: (next: { values: Assumptions; calibration: Notes }) => void;
}) {
  const t = useTranslations('profiles.sizes');
  const tc = useTranslations('common');
  const headingId = useId();
  const [name, setName] = useState('');
  const [copyFrom, setCopyFrom] = useState(values.sizes[0] ?? '');
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [error, setError] = useState<SizeEditError | null>(null);

  const run = (edit: SizeEdit) => {
    if ('error' in edit) {
      setError(edit.error);
      return false;
    }
    setError(null);
    onChange(edit);
    return true;
  };
  const from = values.sizes.includes(copyFrom) ? copyFrom : (values.sizes[0] ?? '');

  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <div className="grid gap-1">
        <h3 id={headingId} className="text-lg font-medium">
          {t('title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('hint')}</p>
      </div>
      <ol className="grid gap-1.5">
        {values.sizes.map((s, i) => (
          <li key={s} className="flex flex-wrap items-center gap-2">
            {renaming?.from === s ? (
              <>
                <Input
                  aria-label={t('renameTo', { size: s })}
                  className="w-28"
                  value={renaming.to}
                  maxLength={12}
                  onChange={(e) => setRenaming({ from: s, to: e.target.value })}
                />
                <Button
                  size="sm"
                  onClick={() =>
                    run(renameSize(values, calibration, s, renaming.to)) && setRenaming(null)
                  }
                >
                  {t('saveName')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRenaming(null)}>
                  {tc('cancel')}
                </Button>
              </>
            ) : (
              <span className="min-w-16 font-mono text-sm">{s}</span>
            )}
            {editable && renaming?.from !== s ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('moveUp', { size: s })}
                  disabled={i === 0}
                  onClick={() => run(moveSize(values, calibration, s, -1))}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('moveDown', { size: s })}
                  disabled={i === values.sizes.length - 1}
                  onClick={() => run(moveSize(values, calibration, s, 1))}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('rename', { size: s })}
                  onClick={() => setRenaming({ from: s, to: s })}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('remove', { size: s })}
                  onClick={() => run(removeSize(values, calibration, s))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </>
            ) : null}
          </li>
        ))}
      </ol>
      {editable ? (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('name')} className="w-36">
            {(c) => (
              <Input {...c} value={name} maxLength={12} onChange={(e) => setName(e.target.value)} />
            )}
          </Field>
          <Field label={t('copyFrom')} className="w-36">
            {(c) => (
              <NativeSelect {...c} value={from} onChange={(e) => setCopyFrom(e.target.value)}>
                {values.sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Button
            variant="outline"
            onClick={() => run(addSize(values, calibration, name, from)) && setName('')}
          >
            <Plus aria-hidden="true" />
            {t('add')}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      ) : null}
    </section>
  );
}
