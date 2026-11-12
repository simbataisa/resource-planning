'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { GROUP_KEYS, type Actuals, type GroupKey } from '@sit/schemas';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/patterns/empty-state';
import { Eyebrow } from '@/components/patterns/eyebrow';
import { Field } from '@/components/patterns/field';
import { PageHeader } from '@/components/patterns/page-header';
import { QueryState } from '@/components/patterns/query-state';
import { Link } from '@/i18n/navigation';
import { formatDateTime, formatInt, num1, pctS } from '@/lib/format';
import { principalFromMe } from '@/lib/me';
import { useActuals, useEstimate, useMe, useRecordActuals } from '@/lib/query/hooks';
import { can } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { useQueryState } from '../shared/use-query-state';

/**
 * Actuals for one approved version (release 3, P-02): record what an SIT cycle measured and
 * compare it with the estimate. Measured rates sit next to the assumption they inform; a
 * QE Lead decides whether to put them in a profile (no automatic calibration, design 3).
 */
export function ActualsPage({ estimateId, number }: { estimateId: string; number: number }) {
  const t = useTranslations('actuals');
  const locale = useLocale();
  const estimate = useEstimate(estimateId);
  const actuals = useActuals(estimateId, number);
  const state = useQueryState(actuals);
  const me = useMe();
  const { remove } = useRecordActuals(estimateId, number);
  const principal = me.data ? principalFromMe(me.data) : null;
  const projectId = estimate.data?.projectId;
  const version = estimate.data?.versions.find((v) => v.number === number);
  const approved = version?.status === 'APPROVED' || version?.status === 'SUPERSEDED';
  const mayRecord = principal && projectId ? can(principal, 'actuals.record', projectId) : false;
  const isLead = principal && projectId ? can(principal, 'version.approve', projectId) : false;
  const items = actuals.data?.items ?? [];

  return (
    <div className="grid gap-6">
      <Link
        href={`/estimates/${estimateId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('back', { name: estimate.data?.name ?? '…' })}
      </Link>
      <PageHeader title={t('title', { n: number })} description={t('description')} />
      {version && !approved ? (
        <Alert>
          <AlertDescription>{t('notApproved')}</AlertDescription>
        </Alert>
      ) : null}
      {mayRecord && approved ? <RecordForm estimateId={estimateId} number={number} /> : null}
      <QueryState {...state}>
        {items.length === 0 ? (
          <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
        ) : (
          items.map((a) => (
            <CycleCard
              key={a.id}
              a={a}
              when={formatDateTime(a.recordedAt, locale)}
              canRemove={a.recordedBy.id === me.data?.id || isLead}
              removing={remove.isPending}
              onRemove={() => remove.mutate(a.id)}
            />
          ))
        )}
      </QueryState>
    </div>
  );
}

const pct = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${pctS(v)}`);
const tone = (v: number | null) =>
  v === null ? '' : v > 0.1 ? 'text-bad' : v < -0.1 ? 'text-good' : '';

function CycleCard({
  a,
  when,
  canRemove,
  removing,
  onRemove,
}: {
  a: Actuals;
  when: string;
  canRemove: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const t = useTranslations('actuals');
  const tg = useTranslations('catalogue.groups');
  const tr = useTranslations('assumptionsTab.rows');
  const [confirming, setConfirming] = useState(false);
  const rate = (key: string, v: number | number[] | null) => {
    if (v === null) return '—';
    if (Array.isArray(v)) return v.map((x) => num1(x)).join(' / ');
    if (key === 'retestRate') return pctS(v);
    return num1(v);
  };
  const groupRows: Record<string, Actuals['variance']['groups']> = {};
  for (const r of a.variance.groups) (groupRows[r.key.split('.')[0]!] ??= []).push(r);

  return (
    <section
      aria-labelledby={`cycle-${a.id}`}
      className="grid gap-4 rounded-lg border bg-card p-5 shadow-card"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <Eyebrow>{t('cycle')}</Eyebrow>
          <h2 id={`cycle-${a.id}`} className="text-[1.4rem] font-light">
            {a.cycleLabel}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('recorded', { name: a.recordedBy.displayName, when })}
          </p>
          {a.note ? <p className="text-sm italic text-muted-foreground">{a.note}</p> : null}
        </div>
        {canRemove ? (
          confirming ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
                {t('keep')}
              </Button>
              <Button size="sm" disabled={removing} onClick={onRemove}>
                {t('confirmRemove')}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" />
              {t('remove')}
            </Button>
          )
        ) : null}
      </header>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('measure')}</TableHead>
              <TableHead className="text-right">{t('estimate')}</TableHead>
              <TableHead className="text-right">{t('actual')}</TableHead>
              <TableHead className="text-right">{t('variance')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {a.variance.totals.map((r) => (
              <TableRow key={r.key}>
                <TableCell>{t(`totals.${r.key}`)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatInt(r.estimate ?? 0)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {r.actual === null ? '—' : formatInt(r.actual)}
                </TableCell>
                <TableCell className={cn('text-right font-mono tabular-nums', tone(r.pct))}>
                  {pct(r.pct)}
                </TableCell>
              </TableRow>
            ))}
            {Object.entries(groupRows).map(([g, rows]) =>
              rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="pl-6 text-muted-foreground">
                    {tg(g)} · {t(`totals.${r.key.split('.')[1]}`)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatInt(r.estimate ?? 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.actual === null ? '—' : formatInt(r.actual)}
                  </TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', tone(r.pct))}>
                    {pct(r.pct)}
                  </TableCell>
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-2">
        <h3 className="text-base font-semibold">{t('ratesTitle')}</h3>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('ratesHint')}</p>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('rate')}</TableHead>
                <TableHead>{t('assumption')}</TableHead>
                <TableHead className="text-right">{t('inVersion')}</TableHead>
                <TableHead className="text-right">{t('measured')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.variance.rates.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{t(`rates.${r.key}`)}</TableCell>
                  <TableCell>
                    {tr(r.path)}{' '}
                    <span className="font-mono text-xs text-muted-foreground">({r.path})</span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {rate(r.key, r.assumption)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.actual === null ? (
                      <Badge variant="outline">{t('notMeasured')}</Badge>
                    ) : (
                      rate(r.key, r.actual)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm">
          <Link href="/profiles" className="text-primary hover:underline">
            {t('toProfiles')}
          </Link>
        </p>
      </div>
    </section>
  );
}

type NumKey =
  | 'executedCases'
  | 'totalHours'
  | 'executionHours'
  | 'designedCases'
  | 'designHours'
  | 'retestedCases'
  | 'productiveHoursPerDay';
const FIELDS: NumKey[] = [
  'executedCases',
  'totalHours',
  'executionHours',
  'designedCases',
  'designHours',
  'retestedCases',
  'productiveHoursPerDay',
];
const REQUIRED = new Set<NumKey>(['executedCases', 'totalHours']);

function RecordForm({ estimateId, number }: { estimateId: string; number: number }) {
  const t = useTranslations('actuals');
  const tg = useTranslations('catalogue.groups');
  const { record } = useRecordActuals(estimateId, number);
  const [label, setLabel] = useState('');
  const [values, setValues] = useState<Partial<Record<NumKey, string>>>({});
  const [groups, setGroups] = useState<{ group: GroupKey; cases: string; hours: string }[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const num = (s: string | undefined) =>
    s === undefined || s.trim() === '' ? undefined : Number(s);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setError(t('form.labelRequired'));
    if ([...REQUIRED].some((k) => num(values[k]) === undefined))
      return setError(t('form.totalsRequired'));
    setError(null);
    const data = Object.fromEntries(
      FIELDS.map((k) => [k, num(values[k])]).filter(([, v]) => v !== undefined),
    );
    record.mutate(
      {
        cycleLabel: label.trim(),
        note: note.trim() || undefined,
        data: {
          ...(data as { executedCases: number; totalHours: number }),
          groups: groups.map((g) => ({
            group: g.group,
            cases: Number(g.cases || 0),
            hours: Number(g.hours || 0),
          })),
        },
      },
      {
        onSuccess: () => {
          setLabel('');
          setValues({});
          setGroups([]);
          setNote('');
        },
      },
    );
  }

  const unused = GROUP_KEYS.filter((k) => !groups.some((g) => g.group === k));

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="record-title"
      className="grid gap-4 rounded-lg border bg-card p-5 shadow-card"
    >
      <h2 id="record-title" className="text-[1.4rem] font-light">
        {t('form.title')}
      </h2>
      <p className="max-w-3xl text-sm text-muted-foreground">{t('form.hint')}</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label={t('form.cycleLabel')}>
          {(c) => (
            <Input {...c} value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
          )}
        </Field>
        {FIELDS.map((k) => (
          <Field
            key={k}
            label={`${t(`form.${k}`)}${REQUIRED.has(k) ? '' : ` ${t('form.optional')}`}`}
          >
            {(c) => (
              <Input
                {...c}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={values[k] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
              />
            )}
          </Field>
        ))}
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t('form.groups')}</legend>
        {groups.map((g, i) => (
          <div key={g.group} className="flex flex-wrap items-end gap-2">
            <span className="min-w-56 text-sm">{tg(g.group)}</span>
            <Field label={t('form.groupCases')}>
              {(c) => (
                <Input
                  {...c}
                  type="number"
                  min={0}
                  className="w-28"
                  value={g.cases}
                  onChange={(e) =>
                    setGroups((gs) =>
                      gs.map((x, j) => (j === i ? { ...x, cases: e.target.value } : x)),
                    )
                  }
                />
              )}
            </Field>
            <Field label={t('form.groupHours')}>
              {(c) => (
                <Input
                  {...c}
                  type="number"
                  min={0}
                  step="any"
                  className="w-28"
                  value={g.hours}
                  onChange={(e) =>
                    setGroups((gs) =>
                      gs.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)),
                    )
                  }
                />
              )}
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setGroups((gs) => gs.filter((_, j) => j !== i))}
            >
              {t('form.removeGroup')}
            </Button>
          </div>
        ))}
        {unused.length ? (
          <div className="flex items-end gap-2">
            <Field label={t('form.addGroup')}>
              {(c) => (
                <NativeSelect
                  {...c}
                  value=""
                  onChange={(e) =>
                    e.target.value &&
                    setGroups((gs) => [
                      ...gs,
                      { group: e.target.value as GroupKey, cases: '', hours: '' },
                    ])
                  }
                >
                  <option value="">{t('form.pickGroup')}</option>
                  {unused.map((k) => (
                    <option key={k} value={k}>
                      {tg(k)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </div>
        ) : null}
      </fieldset>
      <Field label={t('form.note')}>
        {(c) => (
          <Textarea
            {...c}
            rows={2}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </Field>
      {error || record.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{error ?? record.error?.message}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" disabled={record.isPending}>
          <Plus aria-hidden="true" />
          {t('form.submit')}
        </Button>
      </div>
    </form>
  );
}
