'use client';

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

/**
 * The cards of the profile page's side panel (two-column layout): status, calibration and
 * feature sizes. Presentation only; the profile editor owns the state.
 */
function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid gap-2 rounded-lg border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Status, name and the draft's save and publish actions. */
export function StatusCard({ children }: { children: ReactNode }) {
  const t = useTranslations('profiles.panel');
  return <Card title={t('status')}>{children}</Card>;
}

/** "N of T rows calibrated" with a bar; T is the profile's own row total (ADR-0021). */
export function CalibrationCard({ calibrated, total }: { calibrated: number; total: number }) {
  const t = useTranslations('profiles.panel');
  const label = t('calibrated', { n: calibrated, t: total });
  const pct = total ? Math.round((calibrated / total) * 100) : 0;
  return (
    <Card title={t('calibration')}>
      <p className="text-sm">{label}</p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={calibrated}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-chart-good" style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}

/**
 * The sizes as chips, in order. In a draft, "Edit sizes" opens `editor` in a side panel, so the
 * size editor keeps its full width.
 */
export function SizesCard({
  sizes,
  editable,
  editor,
}: {
  sizes: readonly string[];
  editable: boolean;
  editor: (titleId: string) => ReactNode;
}) {
  const t = useTranslations('profiles.panel');
  const tc = useTranslations('common');
  const titleId = useId();
  return (
    <Card
      title={t('sizes')}
      action={
        editable ? (
          <Sheet>
            <SheetTriggerButton label={t('editSizes')} />
            <SheetContent closeLabel={tc('close')} className="overflow-y-auto p-5 sm:max-w-md">
              <SheetHeader>
                <SheetTitle>{t('sizes')}</SheetTitle>
                <SheetDescription className="sr-only">{t('sizesHint')}</SheetDescription>
              </SheetHeader>
              {/* Radix ties the dialog to its own title id; the editor gets its own label. */}
              <span id={titleId} className="sr-only">
                {t('sizes')}
              </span>
              {editor(titleId)}
            </SheetContent>
          </Sheet>
        ) : null
      }
    >
      <ul className="flex flex-wrap gap-1.5">
        {sizes.map((s) => (
          <li key={s} className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs">
            {s}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t('sizesHint')}</p>
    </Card>
  );
}

function SheetTriggerButton({ label }: { label: string }) {
  return (
    <SheetTrigger asChild>
      <Button size="sm" variant="outline">
        <Pencil aria-hidden="true" />
        {label}
      </Button>
    </SheetTrigger>
  );
}
