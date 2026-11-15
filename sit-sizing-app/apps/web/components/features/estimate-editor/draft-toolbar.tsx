'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Check, CircleAlert, Loader2, Save } from 'lucide-react';
import type { Version } from '@sit/schemas';
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
import { useEditor, type EditorAction, type EditorState } from './store';
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
 * What this tab does once it holds the lock again ("Open here instead", or the renewal after a
 * back/forward cache restore): carry on with the values on screen (the draft did not change),
 * restart from the server's copy (nothing unsaved), or show recovery (the draft changed and there
 * are unsaved values; never save them over newer work).
 */
export type Reclaim = 'continue' | 'reload' | 'lost';

/** Decides the {@link Reclaim} outcome from the draft the lock call returned. */
export function reclaimWith(
  state: Pick<EditorState, 'rowVersion' | 'dirty'>,
  dispatch: (action: EditorAction) => void,
): (v: Version) => Reclaim {
  return (v) => {
    if (v.rowVersion === state.rowVersion) {
      dispatch({ type: 'relocked', rowVersion: v.rowVersion });
      return 'continue';
    }
    return state.dirty ? 'lost' : 'reload';
  };
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
  onResume,
  busyRef,
}: {
  estimateId: string;
  versionNumber: number;
  onLost: (reason: LostReason) => void;
  /** The page came back from the back/forward cache: renew the lock before editing resumes. */
  onResume: (reclaim: (v: Version) => Reclaim) => void;
  /** Receives "is a save pending or in flight?", so the editor keeps the lock on unmount. */
  busyRef?: MutableRefObject<() => boolean>;
}) {
  const { state, dispatch, editable } = useEditor();
  const patch = usePatchDraft(estimateId);
  const lock = useLockDraft(estimateId);
  const latest = useRef({ state, busy: false, onLost, onResume });
  useEffect(() => {
    latest.current = { state, busy: state.dirty || patch.isPending, onLost, onResume };
    if (busyRef) busyRef.current = () => latest.current.busy;
  });
  // Refreshing or closing this tab frees the lock, so a reload renews instead of "open elsewhere".
  // Not while an autosave is pending or in flight: that save would be refused.
  useReleaseLockOnPageHide(estimateId, () => latest.current.busy);
  // Back/forward cache restore: the lock may have been released on page hide, or lapsed.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) latest.current.onResume(reclaimWith(latest.current.state, dispatch));
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [dispatch]);
  const [failed, setFailed] = useState(false);

  const lost = (e: unknown) => {
    const reason = lockConflict(e);
    if (reason) latest.current.onLost(reason);
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
      <SaveVersionDialog
        estimateId={estimateId}
        number={versionNumber}
        flush={flush}
        onLost={(reason) => latest.current.onLost(reason)}
      />
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
  onLost,
}: {
  estimateId: string;
  number: number;
  flush: () => Promise<boolean>;
  /** Saving was refused because the draft is open elsewhere: switch to recovery. */
  onLost: (reason: LostReason) => void;
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
      } catch (e) {
        if (lockConflict(e) === 'elsewhere') {
          // Open in another tab or the assistant: recovery keeps the values and offers the
          // download, rather than a generic error inside a dialog that can no longer save.
          setOpen(false);
          setBusy(false);
          onLost('elsewhere');
          return;
        }
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
