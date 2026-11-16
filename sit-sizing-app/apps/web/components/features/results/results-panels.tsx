'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  GROUPS,
  gapRows,
  sensitivity,
  shiftLeftScenarios,
  type Mode,
  type ModeResult,
} from '@sit/engine';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CollapsibleSection } from '@/components/patterns/collapsible-section';
import { ComparisonBars } from '@/components/patterns/comparison-bars';
import { Eyebrow } from '@/components/patterns/eyebrow';
import { Field } from '@/components/patterns/field';
import { TornadoChart } from '@/components/patterns/tornado-chart';
import { formatFte as f1, formatInt as fmt, num1, pctS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useEditor } from '../estimate-editor/store';

const sum3 = (a: readonly number[]) => a[0]! + a[1]! + a[2]!;
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');

/** Panel frame with the prototype's eyebrow + heading. */
function Panel({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-lg border bg-card p-5 shadow-card">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-[1.6rem] font-light">{title}</h2>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** The prototype's callout: navy left edge on the soft detailed background. */
export const Callout = ({ children }: { children: ReactNode }) => (
  <p className="rounded-r-lg border-l-4 border-detailed bg-detailed-soft px-3.5 py-2.5 text-[0.98rem]">
    {children}
  </p>
);

/** Results below the inputs (design 7): gap table, sensitivity, scenarios, worked example. */
export function ResultsPanels() {
  return (
    <div className="grid gap-6">
      <GapPanel />
      <SensitivityPanel />
      <ScenarioPanel />
      <WorkedExample />
    </div>
  );
}

function GapPanel() {
  const t = useTranslations('results.gap');
  const tg = useTranslations('catalogue.groups');
  const { results, state } = useEditor();
  const { rough: R, detailed: D } = results;
  const A = state.assumptions;
  const rows = gapRows(results);
  let max = 1;
  for (const G of GROUPS) max = Math.max(max, R.groups[G.key].cases, D.groups[G.key].cases);
  const per = D.per || 1;
  const totH = D.hours - R.hours;
  const sorted = rows.slice().sort((a, b) => Math.abs(b.deltaHours) - Math.abs(a.deltaHours));
  const [t1, t2] = sorted;
  const callout =
    Math.abs(totH) < 1e-6 || !t1 || !t2
      ? t('match')
      : [
          t(D.fte >= R.fte ? 'higher' : 'lower', { n: f1(Math.abs(D.fte - R.fte)) }),
          t('explain', { a: tg(t1.group), ap: t1.share, b: tg(t2.group), bp: t2.share }),
          t('design', { r: A.designNoFSD, d: A.designFSD }),
        ].join(' ');
  const tone = (n: number) => (n > 0 ? 'text-bad' : n < 0 ? 'text-good' : '');

  return (
    <Panel
      eyebrow={t('eyebrow')}
      title={t('title')}
      aside={
        <span className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i aria-hidden="true" className="size-2.5 rounded-full bg-rough" />
            {t('legendRough')}
          </span>
          <span className="flex items-center gap-1.5">
            <i aria-hidden="true" className="size-2.5 rounded-full bg-detailed" />
            {t('legendDetailed')}
          </span>
        </span>
      }
    >
      <Callout>{callout}</Callout>
      <div data-tour="gap-table" className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('driver')}</TableHead>
              <TableHead className="text-right">{t('rough')}</TableHead>
              <TableHead className="text-right">{t('detailed')}</TableHead>
              <TableHead>
                <span className="sr-only">{t('bars')}</span>
              </TableHead>
              <TableHead className="text-right">{t('dCases')}</TableHead>
              <TableHead className="text-right">{t('dFte')}</TableHead>
              <TableHead className="text-right">{t('share')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.group}>
                <TableCell>{tg(r.group)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {fmt(r.roughCases)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {fmt(r.detailedCases)}
                </TableCell>
                <TableCell className="min-w-32">
                  <ComparisonBars
                    label={t('barsLabel', {
                      label: tg(r.group),
                      r: fmt(r.roughCases),
                      d: fmt(r.detailedCases),
                    })}
                    rough={r.roughCases}
                    detailed={r.detailedCases}
                    max={max}
                  />
                </TableCell>
                <TableCell className={cn('text-right font-mono tabular-nums', tone(r.deltaCases))}>
                  {sign(r.deltaCases)}
                  {fmt(Math.abs(r.deltaCases))}
                </TableCell>
                <TableCell className={cn('text-right font-mono tabular-nums', tone(r.deltaHours))}>
                  {r.deltaHours >= 0 ? '+' : '−'}
                  {f1(Math.abs(r.deltaHours / per))}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.share}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>{t('total')}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmt(R.cases)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmt(D.cases)}</TableCell>
              <TableCell />
              <TableCell className="text-right font-mono tabular-nums">
                {D.cases >= R.cases ? '+' : '−'}
                {fmt(Math.abs(D.cases - R.cases))}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {D.fte >= R.fte ? '+' : '−'}
                {f1(Math.abs(D.fte - R.fte))}
              </TableCell>
              <TableCell className="text-right">100%</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </Panel>
  );
}

function SensitivityPanel() {
  const t = useTranslations('results.sens');
  const { state } = useEditor();
  const [mode, setMode] = useState<Mode>('detailed');
  const [swing, setSwing] = useState(0.25);
  // 42 assumptions × 2 runs: recomputed only when inputs, assumptions, mode or swing change.
  const { base, rows } = useMemo(
    () => sensitivity(mode, state.inputs, state.assumptions, swing),
    [mode, swing, state.inputs, state.assumptions],
  );
  const top = rows[0];
  return (
    <Panel
      eyebrow={t('eyebrow')}
      title={t('title')}
      aside={
        <div className="flex flex-wrap gap-4">
          <Field label={t('estimate')}>
            {(control) => (
              <NativeSelect
                {...control}
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
              >
                <option value="detailed">{t('detailed')}</option>
                <option value="rough">{t('rough')}</option>
              </NativeSelect>
            )}
          </Field>
          <Field label={t('swing')}>
            {(control) => (
              <NativeSelect
                {...control}
                value={String(swing)}
                onChange={(e) => setSwing(Number(e.target.value))}
              >
                <option value="0.1">±10%</option>
                <option value="0.25">±25%</option>
                <option value="0.5">±50%</option>
              </NativeSelect>
            )}
          </Field>
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">
        {top
          ? t('hint', {
              s: Math.round(swing * 100),
              mode: t(mode === 'rough' ? 'modeRough' : 'modeDetailed'),
              f: f1(base),
              t: t(`items.${top.key}`).toLowerCase(),
              lo: f1(top.lo),
              hi: f1(top.hi),
            })
          : t('none')}
      </p>
      <TornadoChart
        label={t('title')}
        base={base}
        rows={rows.map((r) => ({
          key: r.key,
          label: t(`items.${r.key}`),
          lo: r.lo,
          hi: r.hi,
          valueText: t('range', { lo: f1(r.lo), hi: f1(r.hi) }),
        }))}
      />
      <p className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i aria-hidden="true" className="size-2.5 rounded-sm bg-good" />
          {t('fewer')}
        </span>
        <span className="flex items-center gap-1.5">
          <i aria-hidden="true" className="size-2.5 rounded-sm bg-bad" />
          {t('more')}
        </span>
        <span>{t('centre')}</span>
      </p>
    </Panel>
  );
}

function ScenarioPanel() {
  const t = useTranslations('results.scen');
  const { state } = useEditor();
  const ev = state.inputs.evidence;
  const sc = useMemo(
    () => shiftLeftScenarios(state.inputs, state.assumptions),
    [state.inputs, state.assumptions],
  );
  const max = Math.max(...sc.map((s) => s.result.fte)) || 1;
  const byKey = Object.fromEntries(sc.map((s) => [s.key, s.result])) as Record<
    'allGates' | 'current' | 'noGates',
    ModeResult
  >;
  const sub = {
    allGates: t('allGatesSub'),
    current: t('currentSub', {
      m: ev.mutation,
      r: ev.ruleCov,
      b: ev.valBE,
      f: ev.valFE,
      p: ev.mapCov,
      u: ev.feUnit,
      s: ev.feMut,
    }),
    noGates: t('noGatesSub'),
  };
  const save1 = byKey.current.fte - byKey.allGates.fte;
  const save2 = byKey.noGates.fte - byKey.allGates.fte;
  return (
    <Panel
      eyebrow={t('eyebrow')}
      title={t('title')}
      aside={<span className="text-xs text-muted-foreground">{t('note')}</span>}
    >
      <ul className="grid gap-3">
        {sc.map((s) => (
          <li
            key={s.key}
            className={cn(
              'grid items-center gap-3 rounded-md px-3 py-2 sm:grid-cols-[minmax(0,18rem)_1fr_auto]',
              s.key === 'current' && 'bg-muted/60',
            )}
          >
            <div>
              <p className={cn('text-sm', s.key === 'current' ? 'font-bold' : 'font-medium')}>
                {t(s.key)}
              </p>
              <p className="text-xs text-muted-foreground">{sub[s.key]}</p>
            </div>
            <span
              aria-hidden="true"
              className="h-[26px] overflow-hidden rounded-[5px] border border-border bg-muted"
            >
              <span
                className={cn('block h-full bg-detailed', s.key !== 'current' && 'opacity-85')}
                style={{ width: `${(s.result.fte / max) * 100}%` }}
              />
            </span>
            <p className="text-right font-mono text-sm tabular-nums">
              <b>{t('fte', { n: f1(s.result.fte) })}</b>
              <br />
              <span className="text-xs text-muted-foreground">
                {t('cases', { n: fmt(s.result.cases) })}
              </span>
            </p>
          </li>
        ))}
      </ul>
      <Callout>
        {save1 > 0.05
          ? t('calloutSave', {
              a: f1(save1),
              c: fmt(byKey.current.cases - byKey.allGates.cases),
              b: f1(save2),
            })
          : t('calloutAll', {
              b: f1(save2),
              c: fmt(byKey.noGates.cases - byKey.allGates.cases),
            })}
      </Callout>
    </Panel>
  );
}

function WorkedExample() {
  const t = useTranslations('results.trace');
  const tc = useTranslations('catalogue.channels');
  const tw = useTranslations('detailTab.summary');
  const { results, state } = useEditor();
  const D = results.detailed;
  const A = state.assumptions;
  const c = D.counts;
  const x = D.explain;
  const grpH = (family: string) =>
    GROUPS.filter((g) => g.family === family).reduce((h, g) => h + D.groups[g.key].hours, 0);
  const channels = [
    tw('web'),
    ...(['web2', 'ios', 'android'] as const).filter((k) => c.ch[k]).map((k) => tc(k)),
  ].join(', ');
  const steps = [
    t('scope', {
      a: num1(x.apis),
      s: num1(sum3(c.screen)),
      i: num1(sum3(c.integration)),
      r: num1(x.rTot),
      w: num1(x.wfTot),
      b: num1(sum3(c.batch)),
      e: num1(sum3(c.event)),
      j: num1(sum3(c.journey)),
      ch: channels,
    }),
    t('cases', { n: fmt(D.cases) }),
    t('appHours', {
      d: num1(D.design),
      cy: A.cycles,
      rg: pctS(A.regression),
      au: pctS(D.auto),
      rt: pctS(D.retest),
      env: D.env.toFixed(2),
    }),
    x.dOn
      ? t('data', {
          f: fmt(sum3(c.data.feed)),
          p: fmt(sum3(c.data.pipe)),
          t: fmt(sum3(c.data.table)),
          c: fmt(sum3(c.data.columns)),
          q: fmt(sum3(c.data.dq)),
          l: A.dataCycles,
          h: fmt(grpH('data')),
        })
      : t('dataOff'),
    x.aOn
      ? t('ai', {
          i: fmt(sum3(c.ai.intent)),
          s: fmt(c.ai.rag),
          o: fmt(sum3(c.ai.ocr)),
          g: fmt(c.ai.guard),
          r: x.iters,
          h: fmt(grpH('ai')),
          m: fmt(D.smeLabelHours),
        })
      : t('aiOff'),
    x.ptOn ? t('pt', { n: x.ptN, r: x.runN, c: x.ptCycles, h: fmt(grpH('pt')) }) : t('ptOff'),
    t('total', { oh: pctS(A.overhead), h: fmt(D.hours) }),
    t('capacity', {
      w: state.inputs.team.weeks,
      dw: A.daysPerWeek,
      ph: A.hoursPerDay,
      hpf: fmt(D.hpf),
      bl: D.blended.toFixed(2),
      per: fmt(D.per),
    }),
    t('fte', {
      h: fmt(D.hours),
      per: fmt(D.per),
      f: f1(D.fte),
      lo: f1(D.lo),
      hi: f1(D.hi),
      b: Math.round(D.band * 100),
    }),
  ];
  return (
    <CollapsibleSection variant="box" title={t('title')}>
      <p className="text-sm text-muted-foreground">{t('hint')}</p>
      <ol className="ml-5 grid list-decimal gap-1.5 text-sm">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </CollapsibleSection>
  );
}
