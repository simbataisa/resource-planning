'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { DRIVERS, FIELD_TYPES, PT_TYPES, itemHours, type Driver } from '@sit/engine';
import type { DetailScope } from '@sit/schemas';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckboxField } from '@/components/patterns/checkbox-field';
import { CollapsibleSection } from '@/components/patterns/collapsible-section';
import { NumberField } from '@/components/patterns/number-field';
import { NumberInput } from '@/components/patterns/number-input';
import { atLeast0, atLeast0Int, atLeast1Int } from '@/lib/clamp';
import { formatFte, formatInt, num1, pctS } from '@/lib/format';
import { ChannelsFieldset } from './channels-fieldset';
import { CountTable } from './count-table';
import { derivedFormulas } from './derived-formulas';
import { useEditor } from './store';

const SECTIONS = [
  'app',
  'fields',
  'rules',
  'channels',
  'data',
  'ai',
  'pt',
  'derived',
  'guide',
] as const;
type Section = (typeof SECTIONS)[number];
const sum3 = (a: readonly number[]) => a[0]! + a[1]! + a[2]!;
const sectionId = (s: Section) => `ds-${s}`;

/** Tab 2 (prototype `#p-detail`): nine numbered sections with live summaries. */
export function DetailScopeTab() {
  const t = useTranslations('detailTab');
  const tc = useTranslations('catalogue');
  const { state, results } = useEditor();
  const D = results.detailed;
  const c = D.counts;
  const x = D.explain;
  const A = state.assumptions;
  // All sections start open except the guide, as in the prototype.
  const [open, setOpen] = useState<Record<Section, boolean>>(
    () => Object.fromEntries(SECTIONS.map((s) => [s, s !== 'guide'])) as Record<Section, boolean>,
  );
  const setAll = (v: boolean) =>
    setOpen(Object.fromEntries(SECTIONS.map((s) => [s, v])) as Record<Section, boolean>);

  const channelNames = [
    t('summary.web'),
    ...(['web2', 'ios', 'android'] as const).filter((k) => c.ch[k]).map((k) => tc(`channels.${k}`)),
  ].join(', ');
  const ptTypes = PT_TYPES.filter((k) => state.inputs.ptTypes[k]).length;
  const est = (fromFsd: boolean) => (fromFsd ? '' : ` ${t('summary.est')}`);

  const summaries: Record<Section, { text: string; empty?: boolean }> = {
    app: {
      text: t('summary.app', {
        a: formatInt(sum3(c.api)),
        s: formatInt(sum3(c.screen)),
        i: formatInt(sum3(c.integration)),
        r: formatInt(sum3(c.rule)),
      }),
    },
    fields: {
      text: t('summary.fields', {
        f: formatInt(c.fields),
        q: formatInt(x.reqF) + est(x.reqIn),
        p: formatInt(x.respF) + est(x.respIn),
      }),
    },
    rules: {
      text: t('summary.rules', {
        r: formatInt(c.roles),
        a: formatInt(c.actions),
        w: formatInt(c.approvals),
        k: formatInt(c.critical),
      }),
    },
    channels: { text: `${channelNames} · ${t('summary.languages', { l: c.languages })}` },
    data: x.dOn
      ? {
          text: t('summary.data', {
            f: formatInt(sum3(c.data.feed)),
            t: formatInt(sum3(c.data.table)),
            c: formatInt(sum3(c.data.columns)),
          }),
        }
      : { text: t('notInScope'), empty: true },
    ai: x.aOn
      ? {
          text: t('summary.ai', {
            i: formatInt(sum3(c.ai.intent)),
            o: formatInt(sum3(c.ai.ocr)),
            t: formatInt(c.ai.tools),
          }),
        }
      : { text: t('notInScope'), empty: true },
    pt: x.ptOn
      ? {
          text: t('summary.pt', {
            n: x.ptN,
            t: ptTypes,
            h: formatInt((x.pt.design + x.pt.env + x.pt.run) * (1 + A.overhead)),
          }),
        }
      : { text: t('notInScope'), empty: true },
    derived: { text: t('summary.derived', { n: formatInt(D.cases) }) },
    guide: { text: '' },
  };

  const body: Record<Section, ReactNode> = {
    app: <AppDrivers />,
    fields: <FieldsSection />,
    rules: <RulesSection />,
    channels: <ChannelsSection />,
    data: <DataSection />,
    ai: <AiSection />,
    pt: <PtSection />,
    derived: <DerivedSection />,
    guide: <GuideSection />,
  };

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t('hint')}</p>
      <nav
        aria-label={t('nav')}
        className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[10px] border bg-muted px-3 py-2.5"
      >
        {SECTIONS.map((s, i) => (
          <a
            key={s}
            href={`#${sectionId(s)}`}
            className={`inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pr-[11px] pl-1 text-[0.84rem] text-foreground no-underline hover:border-brand hover:text-brand focus-visible:border-brand focus-visible:text-brand ${summaries[s].empty ? 'opacity-60' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              setOpen((o) => ({ ...o, [s]: true }));
              const el = document.getElementById(sectionId(s));
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              el?.querySelector('summary')?.focus({ preventScroll: true });
            }}
          >
            <b className="inline-grid size-5 place-items-center rounded-full bg-muted font-mono text-[0.72rem] font-semibold text-muted-foreground">
              {i + 1}
            </b>
            {t(`sections.${s}`)}
          </a>
        ))}
        <span className="ml-auto flex gap-3.5">
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-[0.85rem] font-normal underline underline-offset-2"
            onClick={() => setAll(true)}
          >
            {t('expandAll')}
          </Button>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-[0.85rem] font-normal underline underline-offset-2"
            onClick={() => setAll(false)}
          >
            {t('collapseAll')}
          </Button>
        </span>
      </nav>
      {SECTIONS.map((s, i) => (
        <CollapsibleSection
          key={s}
          id={sectionId(s)}
          index={i + 1}
          title={t(`sections.${s}`)}
          summary={summaries[s].text}
          empty={summaries[s].empty}
          open={open[s]}
          onToggle={(v) => setOpen((o) => (o[s] === v ? o : { ...o, [s]: v }))}
        >
          {body[s]}
        </CollapsibleSection>
      ))}
    </div>
  );
}

/** Edit `inputs.detail` through the store. */
function useDetail() {
  const { state, results, editInputs, editable } = useEditor();
  const edit = (recipe: (d: DetailScope) => void) => editInputs((i) => recipe(i.detail));
  return { d: state.inputs.detail, A: state.assumptions, state, results, edit, editable };
}

const Hint = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);
const FieldGrid = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap gap-x-6 gap-y-4">{children}</div>
);

function AppDrivers() {
  const t = useTranslations('detailTab.app');
  const tc = useTranslations('catalogue.drivers');
  const { d, results, edit, editable, state } = useDetail();
  const R = results.rough.counts;
  return (
    <>
      <Hint>{t('hint')}</Hint>
      <CountTable
        normalize={atLeast0}
        disabled={!editable}
        extraHeader={t('roughSaid')}
        rows={DRIVERS.map((k: Driver) => ({
          key: k,
          label: tc(k),
          values: d[k],
          dimmed: k === 'journey' && !state.inputs.includeL4,
          onChange: (b, v) => edit((x) => void (x[k][b] = v)),
          extra: (
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {formatInt(sum3(R[k]))}
            </TableCell>
          ),
        }))}
      />
      <p className="text-xs text-muted-foreground">
        {t('roughCmp', {
          f: formatInt(R.fields),
          r: formatInt(R.roles),
          a: formatInt(R.actions),
          w: formatInt(R.approvals),
          k: formatInt(R.critical),
          v: R.variants,
          l: R.languages,
        })}
      </p>
    </>
  );
}

function FieldsSection() {
  const t = useTranslations('detailTab.fields');
  const tf = useTranslations('catalogue.fieldTypes');
  const { d, A, results, edit, editable } = useDetail();
  const D = results.detailed;
  const x = D.explain;
  const typed = x.typed;
  return (
    <>
      <Hint>{t('hint')}</Hint>
      <FieldGrid>
        <NumberField
          label={t('input')}
          value={typed ? D.counts.fields : d.fields}
          min={0}
          normalize={atLeast0}
          disabled={!editable || typed}
          hint={typed ? t('locked') : undefined}
          onChange={(v) => edit((s) => void (s.fields = v))}
        />
        <NumberField
          label={t('request')}
          value={d.reqFields}
          min={0}
          normalize={atLeast0Int}
          disabled={!editable}
          onChange={(v) => edit((s) => void (s.reqFields = v))}
        />
        <NumberField
          label={t('response')}
          value={d.respFields}
          min={0}
          normalize={atLeast0Int}
          disabled={!editable}
          onChange={(v) => edit((s) => void (s.respFields = v))}
        />
      </FieldGrid>
      <p className="text-xs text-muted-foreground">
        {t('apiNote', {
          r: formatInt(x.reqIn ? 0 : x.reqF),
          p: formatInt(x.respIn ? 0 : x.respF),
          a: num1(x.apis),
          t: num1(sum3(D.counts.event)),
          u: pctS(A.dtoReuse),
        })}
      </p>
      <CollapsibleSection variant="box" title={t('byType')} defaultOpen={typed}>
        <Hint>{t('byTypeHint')}</Hint>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fieldType')}</TableHead>
                <TableHead className="text-right">{t('matrixCases')}</TableHead>
                <TableHead className="text-right">{t('count')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FIELD_TYPES.map((k) => (
                <TableRow key={k}>
                  <TableCell>{tf(k)}</TableCell>
                  <TableCell className="text-right tabular-nums">{A.ftypes[k].cases}</TableCell>
                  <TableCell className="text-right">
                    <NumberInput
                      aria-label={tf(k)}
                      value={d.fieldTypes[k]}
                      min={0}
                      normalize={atLeast0Int}
                      disabled={!editable}
                      className="ml-auto w-20"
                      onValueChange={(v) => edit((s) => void (s.fieldTypes[k] = v))}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>{t('total')}</TableCell>
                <TableCell className="text-right">
                  {t('perField', { p: x.perField.toFixed(1) })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {typed ? formatInt(D.counts.fields) : '0'}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <Hint>
          {typed
            ? t('lockedNote', { n: formatInt(D.counts.fields) })
            : t('mixNote', { n: formatInt(Number(d.fields) || 0), p: x.perField.toFixed(1) })}
        </Hint>
      </CollapsibleSection>
    </>
  );
}

function RulesSection() {
  const t = useTranslations('detailTab.rules');
  const { d, edit, editable } = useDetail();
  const num = (
    key: 'roles' | 'actions' | 'approvals' | 'critical' | 'variants',
    normalize: (n: number) => number,
    min = 0,
  ) => (
    <NumberField
      label={t(key)}
      value={d[key]}
      min={min}
      normalize={normalize}
      disabled={!editable}
      onChange={(v) => edit((s) => void (s[key] = v))}
    />
  );
  return (
    <>
      <Hint>{t('hint')}</Hint>
      <FieldGrid>
        {num('roles', atLeast0)}
        {num('actions', atLeast0)}
        {num('approvals', atLeast0Int)}
        {num('critical', atLeast0Int)}
        {num('variants', atLeast1Int, 1)}
      </FieldGrid>
    </>
  );
}

function ChannelsSection() {
  const t = useTranslations('detailTab.channels');
  const { d, edit, editable } = useDetail();
  return (
    <>
      <ChannelsFieldset legend={t('legend')} />
      <NumberField
        label={t('languages')}
        value={d.languages}
        min={1}
        normalize={atLeast1Int}
        disabled={!editable}
        onChange={(v) => edit((s) => void (s.languages = v))}
      />
    </>
  );
}

function DataSection() {
  const t = useTranslations('detailTab.data');
  const tc = useTranslations('catalogue.dataDrivers');
  const { d, edit, editable } = useDetail();
  return (
    <>
      <Hint>{t('hint')}</Hint>
      <CountTable
        normalize={atLeast0Int}
        disabled={!editable}
        rows={(['feed', 'pipe', 'table', 'columns', 'dq', 'report'] as const).map((k) => ({
          key: k,
          label: k === 'columns' || k === 'dq' ? t(k) : tc(k),
          values: d.data[k],
          onChange: (b, v) => edit((s) => void (s.data[k][b] = v)),
        }))}
      />
      <FieldGrid>
        {(['scd', 'secured', 'accessRoles'] as const).map((k) => (
          <NumberField
            key={k}
            label={t(k)}
            value={d.data[k]}
            min={0}
            normalize={atLeast0Int}
            disabled={!editable}
            onChange={(v) => edit((s) => void (s.data[k] = v))}
          />
        ))}
      </FieldGrid>
    </>
  );
}

function AiSection() {
  const t = useTranslations('detailTab.ai');
  const tc = useTranslations('catalogue.aiDrivers');
  const { d, edit, editable } = useDetail();
  return (
    <>
      <Hint>{t('hint')}</Hint>
      <CountTable
        normalize={atLeast0Int}
        disabled={!editable}
        rows={(['intent', 'ocr'] as const).map((k) => ({
          key: k,
          label: tc(k),
          values: d.ai[k],
          onChange: (b, v) => edit((s) => void (s.ai[k][b] = v)),
        }))}
      />
      <FieldGrid>
        {(['rag', 'tools', 'guard', 'hitl'] as const).map((k) => (
          <NumberField
            key={k}
            label={t(k)}
            value={d.ai[k]}
            min={0}
            normalize={atLeast0Int}
            disabled={!editable}
            onChange={(v) => edit((s) => void (s.ai[k] = v))}
          />
        ))}
      </FieldGrid>
    </>
  );
}

function PtSection() {
  const t = useTranslations('detailTab.pt');
  const tp = useTranslations('catalogue.ptTypes');
  const { d, state, edit, editable } = useDetail();
  const { editInputs } = useEditor();
  return (
    <>
      <Hint>{t('hint')}</Hint>
      <CountTable
        normalize={atLeast0Int}
        disabled={!editable}
        rows={[
          {
            key: 'scen',
            label: t('scen'),
            values: d.pt.scen,
            onChange: (b, v) => edit((s) => void (s.pt.scen[b] = v)),
          },
        ]}
      />
      <NumberField
        label={t('dataHeavy')}
        value={d.pt.dataHeavy}
        min={0}
        normalize={atLeast0Int}
        disabled={!editable}
        onChange={(v) => edit((s) => void (s.pt.dataHeavy = v))}
      />
      <fieldset className="grid gap-2 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">{t('types')}</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {PT_TYPES.map((k) => (
            <CheckboxField
              key={k}
              label={tp(k)}
              checked={state.inputs.ptTypes[k]}
              disabled={!editable}
              onCheckedChange={(on) => editInputs((i) => void (i.ptTypes[k] = on))}
            />
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-muted-foreground">{t('note')}</p>
    </>
  );
}

function DerivedSection() {
  const t = useTranslations('detailTab.derived');
  const tf = useTranslations('detailTab.derived.f');
  const tg = useTranslations('catalogue.groups');
  const { results, A } = useDetail();
  const D = results.detailed;
  const rows = derivedFormulas(D, A, (k, v) => tf(k, v));
  return (
    <>
      <Hint>{t('hint')}</Hint>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('driver')}</TableHead>
              <TableHead>{t('how')}</TableHead>
              <TableHead className="text-right">{t('cases')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.group}>
                <TableCell className="align-top">{tg(r.group)}</TableCell>
                <TableCell className="font-mono text-xs whitespace-normal">{r.text}</TableCell>
                <TableCell className="text-right align-top tabular-nums">
                  {formatInt(D.groups[r.group].cases)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function GuideSection() {
  const t = useTranslations('detailTab.guide');
  const tc = useTranslations('catalogue');
  const { results, A } = useDetail();
  const D = results.detailed;
  const extra = ['feed', 'pipe', 'table', 'report', 'intent', 'ocr'] as const;
  return (
    <>
      <Hint>{t('hint')}</Hint>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('driver')}</TableHead>
              {[0, 1, 2].map((b) => (
                <TableHead key={b}>{tc(`complexity.${b}`)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {DRIVERS.map((k) => (
              <TableRow key={k}>
                <TableCell className="align-top font-semibold">{tc(`drivers.${k}`)}</TableCell>
                {([0, 1, 2] as const).map((b) => (
                  <TableCell key={b} className="align-top whitespace-normal">
                    {t(`rubric.${k}.${b}`)}
                    <span className="mt-1 block font-mono text-[0.76rem] text-brand">
                      {t('perItem', { h: formatFte(itemHours(k, b, D, A)) })}
                    </span>
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {extra.map((k) => (
              <TableRow key={k}>
                <TableCell className="align-top font-semibold">{t(`extra.${k}.label`)}</TableCell>
                {[0, 1, 2].map((b) => (
                  <TableCell key={b} className="align-top whitespace-normal">
                    {t(`extra.${k}.${b}`)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
