'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { Field } from '@/components/patterns/field';
import { Link } from '@/i18n/navigation';
import { lockTokenFor } from '@/lib/lock-tokens';
import { useApplyProfile, useProfiles } from '@/lib/query/hooks';
import { lockConflict } from './draft-toolbar';
import { useEditor } from './store';

/**
 * The draft's assumption profile, and applying another published one (P-01). Applying
 * replaces every assumption; the editor then continues from the server's recomputed draft.
 */
export function ApplyProfile({
  estimateId,
  projectId,
  profileId,
  onLost,
}: {
  estimateId: string;
  projectId: string;
  profileId: string | null;
  /** Applying was refused because the draft is open elsewhere: switch to recovery. */
  onLost?: () => void;
}) {
  const t = useTranslations('profiles.apply');
  const tc = useTranslations('common');
  const { state, editable, dispatch } = useEditor();
  const profiles = useProfiles(projectId);
  const apply = useApplyProfile(estimateId);
  const all = profiles.data?.items ?? [];
  const current = all.find((p) => p.id === profileId);
  const published = all.filter(
    (p) => p.status === 'PUBLISHED' && (p.scope === 'GLOBAL' || p.projectId === projectId),
  );
  const [choice, setChoice] = useState('');
  const [confirm, setConfirm] = useState(false);
  // Refused as open in another tab or the assistant (LOCKED_ELSEWHERE or RACE).
  const [elsewhere, setElsewhere] = useState(false);
  const picked = published.find((p) => p.id === choice);

  return (
    <div className="grid gap-3 rounded-lg border bg-muted/40 p-4">
      <p className="text-sm">
        {current
          ? t.rich('current', {
              name: current.name,
              link: (chunks) => (
                <Link href={`/profiles/${current.id}`} className="text-primary hover:underline">
                  {chunks}
                </Link>
              ),
            })
          : t('none')}
      </p>
      {editable ? (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('choose')}>
            {(c) => (
              <NativeSelect {...c} value={choice} onChange={(e) => setChoice(e.target.value)}>
                <option value="">{t('pick')}</option>
                {published
                  .filter((p) => p.id !== profileId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </NativeSelect>
            )}
          </Field>
          <Button
            variant="outline"
            disabled={!picked || state.dirty || apply.isPending}
            title={state.dirty ? t('waitForSave') : undefined}
            onClick={() => setConfirm(true)}
          >
            {t('apply')}
          </Button>
        </div>
      ) : null}
      {elsewhere ? (
        <Alert variant="destructive">
          <AlertDescription>{t('lockedElsewhere')}</AlertDescription>
        </Alert>
      ) : apply.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {sizeMissing(apply.error).length
              ? sizeMissing(apply.error)
                  .map((m) => t('sizeMissing', { size: m.size, count: m.features }))
                  .join(' ')
              : apply.error.message}
          </AlertDescription>
        </Alert>
      ) : null}
      {confirm && picked ? (
        <Dialog open onOpenChange={(o) => !o && setConfirm(false)}>
          <DialogContent closeLabel={tc('close')}>
            <DialogHeader>
              <DialogTitle>{t('confirmTitle')}</DialogTitle>
              <DialogDescription>{t('confirmBody', { name: picked.name })}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(false)}>
                {tc('cancel')}
              </Button>
              <Button
                disabled={apply.isPending}
                onClick={() => {
                  setElsewhere(false);
                  apply.mutate(
                    {
                      profileId: picked.id,
                      rowVersion: state.rowVersion,
                      lockToken: lockTokenFor(estimateId),
                    },
                    {
                      onSuccess: (v) => {
                        dispatch({
                          type: 'load',
                          inputs: v.inputs,
                          assumptions: v.assumptions,
                          rowVersion: v.rowVersion,
                        });
                        setChoice('');
                      },
                      onError: (e) => {
                        if (lockConflict(e) !== 'elsewhere') return;
                        setElsewhere(true);
                        onLost?.();
                      },
                      onSettled: () => setConfirm(false),
                    },
                  );
                }}
              >
                {t('apply')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

/** The sizes a refused apply names, one per size the profile lacks (ADR-0021). */
function sizeMissing(error: unknown): { size: string; features: number }[] {
  const details = (error as { details?: unknown[] } | null)?.details ?? [];
  return details.flatMap((d) => {
    const x = d as { reason?: unknown; size?: unknown; features?: unknown };
    return x.reason === 'SIZE_NOT_IN_PROFILE' &&
      typeof x.size === 'string' &&
      typeof x.features === 'number'
      ? [{ size: x.size, features: x.features }]
      : [];
  });
}
