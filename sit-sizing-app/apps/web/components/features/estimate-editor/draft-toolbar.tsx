'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, CircleAlert, Loader2, Save } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/patterns/field';
import { ApiClientError } from '@/lib/http';
import { lockTokenFor, rememberLockToken } from '@/lib/lock-tokens';
import {
  useLockDraft,
  usePatchDraft,
  useReleaseLockOnPageHide,
  useSaveVersion,
} from '@/lib/query/hooks';
import { useEditor } from './store';
import { useTourEvent } from '../tours/use-tour-event';

/** Autosave debounce (design 8.3). */
export const AUTOSAVE_MS = 1500;
/** Heartbeat well inside the 15-minute lock so the lock never lapses while the page is open. */
export const HEARTBEAT_MS = 5 * 60_000;

type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed';

/** Why the lock was lost: open in another tab or the assistant, or any other conflict. */
export type LostReason = 'elsewhere' | 'conflict';

/**
 * Classifies a 409: `LOCKED_ELSEWHERE` (another tab or the assistant has my lock) and `RACE`
 * (another session won a free lock) both mean "open elsewhere"; other 409s are conflicts.
 */
export function lockConflict(e: unknown): LostReason | null {
  if (!(e instanceof ApiClientError) || e.status !== 409) return null;
  return e.reason === 'LOCKED_ELSEWHERE' || e.reason === 'RACE' ? 'elsewhere' : 'conflict';
}

/**
 * Keeps the open draft in sync with the server while the user holds the edit lock (U-09):
 * debounced autosave with `rowVersion`, a lock heartbeat, the save status and "Save version".
 * Every call sends this tab's lock token (memory only). A 409 means the lock or the draft was
 * lost: `onLost` switches the editor to recovery.
 */
export function DraftToolbar({
  estimateId,
  versionNumber,
  onLost,
}: {
  estimateId: string;
  versionNumber: number;
  onLost: (reason: LostReason) => void;
}) {
  const { state, dispatch, editable } = useEditor();
  const patch = usePatchDraft(estimateId);
  const lock = useLockDraft(estimateId);
  // Refreshing or closing this tab frees the lock, so a reload renews instead of "open elsewhere".
  useReleaseLockOnPageHide(estimateId);
  const [failed, setFailed] = useState(false);
  const onLostRef = useRef(onLost);
  useEffect(() => {
    onLostRef.current = onLost;
  });

  const lost = (e: unknown) => {
    const reason = lockConflict(e);
    if (reason) onLostRef.current(reason);
    return reason !== null;
  };

  async function flush(): Promise<boolean> {
    if (!state.dirty) return true;
    const revision = state.revision;
    try {
      const v = await patch.mutateAsync({
        rowVersion: state.rowVersion,
        inputs: state.inputs,
        assumptions: state.assumptions,
        lockToken: lockTokenFor(estimateId),
      });
      dispatch({ type: 'saved', rowVersion: v.rowVersion, revision });
      setFailed(false);
      return true;
    } catch (e) {
      if (!lost(e)) setFailed(true);
      return false;
    }
  }

  // Debounced autosave. Waits while a save is in flight so two saves never race on rowVersion.
  useEffect(() => {
    if (!editable || !state.dirty || patch.isPending) return;
    const h = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush reads the latest state
  }, [editable, state.revision, state.dirty, patch.isPending]);

  // Heartbeat: renews the lock even when nothing is typed.
  useEffect(() => {
    if (!editable) return;
    const h = setInterval(() => {
      lock.mutate(
        { takeover: false, lockToken: lockTokenFor(estimateId) },
        {
          // A lapsed lock taken again comes back with a new token.
          onSuccess: (v) => rememberLockToken(estimateId, v.lockToken),
          onError: (e) => void lost(e),
        },
      );
    }, HEARTBEAT_MS);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the mutation object is stable enough
  }, [editable]);

  if (!editable) return null;
  const status: SaveState = patch.isPending
    ? 'saving'
    : failed
      ? 'failed'
      : state.dirty
        ? 'unsaved'
        : 'saved';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SaveStatus status={status} />
      <SaveVersionDialog estimateId={estimateId} number={versionNumber} flush={flush} />
    </div>
  );
}

function SaveStatus({ status }: { status: SaveState }) {
  const t = useTranslations('draft.status');
  const Icon = status === 'saved' ? Check : status === 'failed' ? CircleAlert : Loader2;
  return (
    <span
      role="status"
      data-tour="save-status"
      className={`flex items-center gap-1.5 text-sm ${status === 'failed' ? 'text-bad' : 'text-muted-foreground'}`}
    >
      <Icon
        aria-hidden="true"
        className={`size-4 ${status === 'saving' ? 'animate-spin motion-reduce:animate-none' : ''}`}
      />
      {t(status)}
    </span>
  );
}

function SaveVersionDialog({
  estimateId,
  number,
  flush,
}: {
  estimateId: string;
  number: number;
  flush: () => Promise<boolean>;
}) {
  const t = useTranslations();
  const save = useSaveVersion(estimateId);
  const tourEvent = useTourEvent();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function onSave() {
    setBusy(true);
    setError(false);
    // Autosave first, so the frozen version holds exactly what is on screen.
    const ok = await flush();
    if (ok) {
      try {
        await save.mutateAsync({
          note: note.trim() || undefined,
          lockToken: lockTokenFor(estimateId),
        });
        tourEvent('version-saved');
        setOpen(false);
      } catch {
        setError(true);
      }
    } else {
      setError(true);
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-tour="save-version">
          <Save aria-hidden="true" />
          {t('draft.saveVersion')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('draft.saveVersionTitle', { n: number })}</DialogTitle>
          <DialogDescription>{t('draft.saveVersionBody', { n: number })}</DialogDescription>
        </DialogHeader>
        <Field label={t('draft.note')} hint={t('draft.noteHint')}>
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{t('draft.saveError')}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void onSave()} disabled={busy}>
            {busy ? t('draft.saving') : t('draft.saveVersion')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
