'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Assumptions } from '@sit/schemas';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
/** The longest size name (ADR-0021). */
const MAX_NAME = 6;

/**
 * The feature sizes of a profile (ADR-0021): their order is the order the rough-scope picker
 * offers. A draft can add (as a copy of another size), rename, move and remove sizes; anything
 * else shows them read-only. Focus stays with the size being worked on, and errors are tied to
 * the field they are about.
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
  const renameErrorId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const renameButtons = useRef(new Map<string, HTMLButtonElement>());
  const [name, setName] = useState('');
  const [copyFrom, setCopyFrom] = useState(values.sizes[0] ?? '');
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [error, setError] = useState<{ at: 'add' | 'rename'; code: SizeEditError } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ size: string } | 'heading' | null>(null);

  // Moves focus once the list has re-rendered after a rename or a removal.
  useEffect(() => {
    if (focus === 'heading') heading.current?.focus();
    else if (focus) renameButtons.current.get(focus.size)?.focus();
    if (focus) setFocus(null);
  }, [focus]);

  const run = (at: 'add' | 'rename', edit: SizeEdit) => {
    if ('error' in edit) {
      setError({ at, code: edit.error });
      return false;
    }
    setError(null);
    onChange(edit);
    return true;
  };
  const from = values.sizes.includes(copyFrom) ? copyFrom : (values.sizes[0] ?? '');
  const saveRename = () => {
    if (!renaming) return;
    const to = renaming.to.trim();
    // The same name is no change: just close.
    if (to === renaming.from || run('rename', renameSize(values, calibration, renaming.from, to))) {
      setRenaming(null);
      setError(null);
      setFocus({ size: to === renaming.from ? renaming.from : to });
    }
  };
  const cancelRename = () => {
    const size = renaming?.from;
    setRenaming(null);
    setError(null);
    if (size) setFocus({ size });
  };

  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <div className="grid gap-1">
        <h3 id={headingId} ref={heading} tabIndex={-1} className="text-lg font-medium">
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
                  maxLength={MAX_NAME}
                  autoFocus
                  {...(error?.at === 'rename'
                    ? { 'aria-invalid': true, 'aria-describedby': renameErrorId }
                    : {})}
                  onChange={(e) => setRenaming({ from: s, to: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveRename();
                    } else if (e.key === 'Escape') cancelRename();
                  }}
                />
                <Button size="sm" onClick={saveRename}>
                  {t('saveName')}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelRename}>
                  {tc('cancel')}
                </Button>
                {error?.at === 'rename' ? (
                  <p id={renameErrorId} role="alert" className="basis-full text-xs text-bad">
                    {t(`errors.${error.code}`)}
                  </p>
                ) : null}
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
                  onClick={() => run('add', moveSize(values, calibration, s, -1))}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('moveDown', { size: s })}
                  disabled={i === values.sizes.length - 1}
                  onClick={() => run('add', moveSize(values, calibration, s, 1))}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('rename', { size: s })}
                  ref={(el) => {
                    if (el) renameButtons.current.set(s, el);
                    else renameButtons.current.delete(s);
                  }}
                  onClick={() => {
                    setError(null);
                    setRenaming({ from: s, to: s });
                  }}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('remove', { size: s })}
                  onClick={() => setRemoving(s)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </>
            ) : null}
          </li>
        ))}
      </ol>
      {editable ? (
        <div className="flex flex-wrap items-start gap-3">
          <Field
            label={t('name')}
            className="w-44"
            {...(error?.at === 'add' ? { error: t(`errors.${error.code}`) } : {})}
          >
            {(c) => (
              <Input
                {...c}
                value={name}
                maxLength={MAX_NAME}
                onChange={(e) => setName(e.target.value)}
              />
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
            className="mt-6"
            onClick={() => run('add', addSize(values, calibration, name, from)) && setName('')}
          >
            <Plus aria-hidden="true" />
            {t('add')}
          </Button>
        </div>
      ) : null}
      {removing ? (
        <Dialog open onOpenChange={(o) => !o && setRemoving(null)}>
          <DialogContent closeLabel={tc('close')}>
            <DialogHeader>
              <DialogTitle>{t('removeTitle', { size: removing })}</DialogTitle>
              <DialogDescription>{t('removeBody')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoving(null)}>
                {tc('cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (run('add', removeSize(values, calibration, removing))) setFocus('heading');
                  setRemoving(null);
                }}
              >
                {t('removeConfirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
