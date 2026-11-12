'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { EstimateDetail, Version, VersionSummary } from '@sit/schemas';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { Eyebrow } from '@/components/patterns/eyebrow';
import { Field } from '@/components/patterns/field';
import { Link } from '@/i18n/navigation';
import { formatDateTime, formatFte } from '@/lib/format';
import { principalFromMe } from '@/lib/me';
import { useCreateDraft, useMe, useReviewVersion } from '@/lib/query/hooks';
import { can } from '@/lib/rbac';

type Action = 'submit' | 'approve' | 'return';
const TONE = {
  DRAFT: 'outline',
  SAVED: 'secondary',
  SUBMITTED: 'warn',
  APPROVED: 'good',
  SUPERSEDED: 'outline',
} as const;

/**
 * Version history with the approval workflow (release 2, V-01): submit, approve or return
 * with a note, restore any version as a new draft, and pick two versions to compare.
 */
export function VersionHistory({ estimate, open }: { estimate: EstimateDetail; open: Version }) {
  const t = useTranslations('versions');
  const ts = useTranslations('status');
  const locale = useLocale();
  const me = useMe();
  const review = useReviewVersion(estimate.id);
  const createDraft = useCreateDraft(estimate.id);
  const [dialog, setDialog] = useState<{ action: Action; v: VersionSummary } | null>(null);
  const versions = estimate.versions;
  const [a, setA] = useState(versions[1]?.number ?? versions[0]?.number ?? 1);
  const [b, setB] = useState(versions[0]?.number ?? 1);

  const principal = me.data ? principalFromMe(me.data) : null;
  const pid = estimate.projectId;
  const may = (action: Parameters<typeof can>[1]) =>
    principal ? can(principal, action, pid) : false;
  const hasDraft = versions.some((v) => v.status === 'DRAFT');
  const pending = versions.some((v) => v.status === 'SUBMITTED');
  const meId = me.data?.id;
  const segregated = (v: VersionSummary) => v.createdBy.id === meId || v.submittedBy?.id === meId;
  const when = (iso: string) => formatDateTime(iso, locale);

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-5 shadow-card">
      <header className="grid gap-1.5">
        <Eyebrow>{t('eyebrow')}</Eyebrow>
        <h2 className="text-[1.6rem] font-light">{t('title')}</h2>
      </header>
      {review.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{review.error.message || t('error')}</AlertDescription>
        </Alert>
      ) : null}
      <ol className="grid divide-y rounded-lg border">
        {versions.map((v) => (
          <li
            key={v.id}
            className="grid gap-2 px-4 py-3 md:grid-cols-[auto_1fr_auto] md:items-center"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">v{v.number}</span>
              <Badge variant={TONE[v.status]}>{ts(v.status)}</Badge>
              {v.number === open.number ? <Badge variant="outline">{t('current')}</Badge> : null}
            </div>
            <div className="grid gap-0.5 text-sm">
              <span className="font-mono tabular-nums">
                {formatFte(v.roughFte)} / {formatFte(v.detailedFte)} FTE
              </span>
              <span className="text-muted-foreground">
                {t('by', { name: v.createdBy.displayName, when: when(v.updatedAt) })}
                {v.submittedBy && v.submittedAt
                  ? ` · ${t('submittedBy', { name: v.submittedBy.displayName, when: when(v.submittedAt) })}`
                  : ''}
                {v.approvedBy && v.approvedAt
                  ? ` · ${t('approvedBy', { name: v.approvedBy.displayName, when: when(v.approvedAt) })}`
                  : ''}
              </span>
              {v.note ? <span className="text-muted-foreground italic">{v.note}</span> : null}
              {v.status === 'SUBMITTED' && may('version.approve') && segregated(v) ? (
                <span className="text-xs text-muted-foreground">{t('sodHint')}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {v.status === 'SAVED' && may('version.submit') ? (
                <Button
                  size="sm"
                  disabled={pending}
                  title={pending ? t('pending') : undefined}
                  onClick={() => setDialog({ action: 'submit', v })}
                >
                  {t('submit')}
                </Button>
              ) : null}
              {v.status === 'SUBMITTED' && may('version.approve') ? (
                <>
                  <Button
                    size="sm"
                    disabled={segregated(v)}
                    onClick={() => setDialog({ action: 'approve', v })}
                  >
                    {t('approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDialog({ action: 'return', v })}
                  >
                    {t('return')}
                  </Button>
                </>
              ) : null}
              {v.status !== 'DRAFT' && !hasDraft && may('draft.create') && !estimate.archived ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={createDraft.isPending}
                  onClick={() => createDraft.mutate(v.number)}
                >
                  {t('restore')}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {open.reviews.length ? (
        <div className="grid gap-2">
          <h3 className="text-base font-semibold">{t('reviews')}</h3>
          <ul className="grid gap-2 text-sm">
            {open.reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-r-lg border-l-4 border-detailed bg-detailed-soft px-3.5 py-2"
              >
                <b>{t(`reviewKind.${r.kind}`)}</b> · {r.author.displayName}, {when(r.createdAt)}
                <p>{r.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {versions.length > 1 ? (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('compareA')}>
            {(c) => (
              <NativeSelect {...c} value={String(a)} onChange={(e) => setA(Number(e.target.value))}>
                {versions.map((v) => (
                  <option key={v.id} value={v.number}>
                    v{v.number}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label={t('compareB')}>
            {(c) => (
              <NativeSelect {...c} value={String(b)} onChange={(e) => setB(Number(e.target.value))}>
                {versions.map((v) => (
                  <option key={v.id} value={v.number}>
                    v{v.number}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Button asChild variant="outline">
            <Link href={`/estimates/${estimate.id}/compare?a=${a}&b=${b}`}>{t('compare')}</Link>
          </Button>
        </div>
      ) : null}

      {dialog ? (
        <ReviewDialog
          action={dialog.action}
          number={dialog.v.number}
          busy={review.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(note) =>
            review.mutate(
              { number: dialog.v.number, action: dialog.action, note },
              { onSettled: () => setDialog(null) },
            )
          }
        />
      ) : null}
    </section>
  );
}

function ReviewDialog({
  action,
  number,
  busy,
  onClose,
  onConfirm,
}: {
  action: Action;
  number: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (note: string | undefined) => void;
}) {
  const t = useTranslations();
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);
  const required = action === 'return';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t(`versions.${action}Title`, { n: number })}</DialogTitle>
          <DialogDescription>{t(`versions.${action}Body`)}</DialogDescription>
        </DialogHeader>
        <Field
          label={required ? t('versions.noteRequired') : t('versions.noteOptional')}
          error={missing ? t('versions.noteMissing') : undefined}
        >
          {(c) => (
            <Textarea
              {...c}
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setMissing(false);
              }}
            />
          )}
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              if (required && !note.trim()) return setMissing(true);
              onConfirm(note.trim() || undefined);
            }}
          >
            {t('versions.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
