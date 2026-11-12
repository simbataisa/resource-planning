'use client';

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { Credit } from '@sit/engine';
import type { Evidence } from '@sit/schemas';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NumberInput } from '@/components/patterns/number-input';
import { StatusChip, type StatusTone } from '@/components/patterns/status-chip';
import { percent } from '@/lib/clamp';
import { formatInt, pctS } from '@/lib/format';
import { useEditor } from './store';

type PctKey =
  | 'mutation'
  | 'ruleCov'
  | 'valBE'
  | 'mapCov'
  | 'jacoco'
  | 'valFE'
  | 'feUnit'
  | 'feMut'
  | 'iosUnit'
  | 'androidUnit'
  | 'dqCov'
  | 'contractCov'
  | 'goldenReuse'
  | 'ptReuse';
type BoolKey = 'evalCI' | 'ptCI' | 'apm';

interface Effect {
  tone: StatusTone;
  chip: string;
  text: string;
}

/** Tab 4 (prototype `#p-ev`): shift-left gate results and what each changes in the estimate. */
export function EvidenceTab() {
  const t = useTranslations('evidenceTab');
  const { state, results, editInputs, editable } = useEditor();
  const { inputs, assumptions: A } = state;
  const E = inputs.evidence;
  const { rough: R, detailed: D } = results;
  const P = D.explain.dOn || D.explain.aOn ? D : R;
  const x = P.explain;
  const ptOnAny = D.explain.ptOn || R.explain.ptOn;
  const pc = (v: number) => Math.round(v * 100);

  const e = (tone: StatusTone, chip: string, text: string): Effect => ({ tone, chip, text });
  const gate = (ok: boolean, g: number, okText: string, weakText: string) =>
    ok ? e('good', t('chip.gateMet'), okText) : e('bad', t('chip.belowGate', { g }), weakText);
  const credit = (state: Credit, sample: string, partial: string, full: string) =>
    state === 'sample'
      ? e('good', t('chip.credited'), sample)
      : state === 'partial'
        ? e('warn', t('chip.partial'), partial)
        : e('bad', t('chip.below50'), full);
  const fieldCredit = (state: Credit, unit: 'Api' | 'Screen', sample: number) =>
    credit(
      state,
      t(`eff.credit${unit}`, { n: sample }),
      t('eff.creditPartial', { p: pc(A.partialShare) }),
      t('eff.creditFull', { n: D.explain.perField.toFixed(1) }),
    );
  const notInScope = (text: string) => e('neutral', t('chip.notInScope'), text);
  const mobile = (k: 'ios' | 'android') =>
    !D.counts.ch[k]
      ? e('neutral', t('chip.channelOff'), t('eff.mobileOff'))
      : gate(
          (Number(E[`${k}Unit`]) || 0) >= A.mobileUnitGate,
          A.mobileUnitGate,
          t('eff.mobileOk'),
          t('eff.mobileWeak', { u: pc(A.mobileUplift) }),
        );
  const mc = formatInt(D.groups.mapping.cases);
  const jc = Number(E.jacoco) || 0;

  const pctRow = (k: PctKey, id: string, effect: Effect, step = 1) => ({
    id,
    effect,
    control: (label: string) => (
      <PercentInput
        label={label}
        value={E[k]}
        step={step}
        disabled={!editable}
        onChange={(v) => editInputs((d) => void (d.evidence[k] = v))}
      />
    ),
  });
  const boolRow = (k: BoolKey, id: string, effect: Effect) => ({
    id,
    effect,
    control: (what: string) => (
      <CheckLabel
        label={t('inPlaceLabel')}
        name={what}
        checked={E[k]}
        disabled={!editable}
        onChange={(v) => editInputs((d) => void ((d.evidence as Evidence)[k] = v))}
      />
    ),
  });

  const groups: { key: string; rows: ReturnType<typeof pctRow>[] }[] = [
    {
      key: 'backend',
      rows: [
        pctRow(
          'mutation',
          'mut',
          gate(
            D.mutOK,
            A.mutationGate,
            t('eff.mutOk'),
            t('eff.mutWeak', { u: pc(A.ruleUplift), w: pc(A.retestWeak), r: pc(A.retest) }),
          ),
        ),
        pctRow(
          'ruleCov',
          'rule',
          credit(
            D.rc,
            t('eff.ruleOk', { n: A.wiringCases }),
            t('eff.rulePartial', { p: pc(A.partialShare) }),
            t('eff.ruleFull'),
          ),
        ),
        pctRow('valBE', 'be', fieldCredit(D.be, 'Api', A.sampleBE)),
        pctRow(
          'mapCov',
          'map',
          credit(
            D.mp,
            t('eff.mapOk'),
            t('eff.mapPartial', { p: pc(A.partialShare), n: mc }),
            t('eff.mapFull', { n: mc }),
          ),
        ),
        pctRow(
          'jacoco',
          'jacoco',
          jc >= 80
            ? e('good', t('chip.meets80'), t('eff.jacoco'))
            : e('warn', t('chip.below80'), t('eff.jacoco')),
        ),
      ],
    },
    {
      key: 'frontend',
      rows: [
        pctRow('valFE', 'fe', fieldCredit(D.fe, 'Screen', A.sampleFE)),
        pctRow(
          'feUnit',
          'feunit',
          gate(
            D.feUnitOK,
            A.feUnitGate,
            t('eff.feunitOk'),
            t('eff.feunitWeak', { u: pc(A.feLogicUplift) }),
          ),
        ),
        pctRow(
          'feMut',
          'femut',
          gate(
            D.feMutOK,
            A.feMutGate,
            t('eff.femutOk'),
            t('eff.femutWeak', { u: pc(A.feMutUplift) }),
          ),
        ),
      ],
    },
    {
      key: 'mobile',
      rows: [
        pctRow('iosUnit', 'ios', mobile('ios')),
        pctRow('androidUnit', 'android', mobile('android')),
      ],
    },
    {
      key: 'dataAi',
      rows: [
        pctRow(
          'dqCov',
          'dq',
          !x.dOn
            ? notInScope(t('eff.daOff'))
            : credit(
                x.dqC,
                t('eff.dqSample', { s: pctS(A.dataSample) }),
                t('eff.dqPartial', { s: pctS(A.partialShare) }),
                t('eff.dqFull'),
              ),
        ),
        pctRow(
          'contractCov',
          'contract',
          !x.dOn
            ? notInScope(t('eff.daOff'))
            : credit(
                x.ctC,
                t('eff.ctSample'),
                t('eff.ctPartial', { s: pctS(A.partialShare) }),
                t('eff.ctFull'),
              ),
        ),
        boolRow(
          'evalCI',
          'evalci',
          !x.aOn
            ? notInScope(t('eff.daOff'))
            : x.evalCI
              ? e('good', t('chip.inPlace'), t('eff.evalci', { p: pctS(A.aiReviewAuto) }))
              : e('warn', t('chip.notInPlace'), t('eff.evalci', { p: pctS(A.aiReviewManual) })),
        ),
        pctRow(
          'goldenReuse',
          'reuse',
          !x.aOn
            ? notInScope(t('eff.daOff'))
            : x.reuse > 0
              ? e(
                  'good',
                  t('chip.reused', { p: pctS(x.reuse) }),
                  t('eff.reuseOn', { p: pctS(x.reuse) }),
                )
              : e('warn', t('chip.newGolden'), t('eff.reuseOff')),
        ),
      ],
    },
    {
      key: 'performance',
      rows: [
        boolRow(
          'ptCI',
          'ptci',
          !ptOnAny
            ? notInScope(t('eff.ptOff'))
            : E.ptCI
              ? e('good', t('chip.inPlace'), t('eff.ptciOn', { c: A.ptCyclesCI, d: A.ptCycles }))
              : e('warn', t('chip.notInPlace'), t('eff.ptciOff', { d: A.ptCycles })),
        ),
        boolRow(
          'apm',
          'apm',
          !ptOnAny
            ? notInScope(t('eff.ptOff'))
            : E.apm
              ? e('good', t('chip.inPlace'), t('eff.apm', { h: A.ptEnvApm }))
              : e('warn', t('chip.notInPlace'), t('eff.apm', { h: A.ptEnvHours })),
        ),
        pctRow(
          'ptReuse',
          'ptreuse',
          !ptOnAny
            ? notInScope(t('eff.ptOff'))
            : Number(E.ptReuse) > 0
              ? e('good', t('chip.reused', { p: pctS(E.ptReuse / 100) }), t('eff.ptReuseOn'))
              : e('warn', t('chip.newScripts'), t('eff.ptReuseOff')),
          5,
        ),
      ],
    },
    {
      key: 'beyond',
      rows: [
        {
          id: 'l4',
          effect: inputs.includeL4
            ? e('warn', t('chip.counted'), t('eff.l4On', { n: formatInt(D.groups.journey.cases) }))
            : e('good', t('chip.notCounted'), t('eff.l4Off')),
          control: (what: string) => (
            <CheckLabel
              label={t('l4Label')}
              name={what}
              checked={inputs.includeL4}
              disabled={!editable}
              onChange={(v) => editInputs((d) => void (d.includeL4 = v))}
            />
          ),
        },
      ],
    },
  ];

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">{t('hint')}</p>
      {groups.map((g) => (
        <section key={g.key} className="grid gap-2">
          <h3 className="text-base font-semibold">{t(`groups.${g.key}`)}</h3>
          <div className="divide-y rounded-lg border">
            {g.rows.map((r) => (
              <EvidenceRow
                key={r.id}
                what={t(`rows.${r.id}.what`)}
                desc={t(`rows.${r.id}.desc`)}
                control={r.control(t(`rows.${r.id}.what`))}
                effect={r.effect}
              />
            ))}
          </div>
        </section>
      ))}
      <section className="grid gap-2">
        <h3 className="text-base font-semibold">{t('groups.spares')}</h3>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {(['test', 'proves', 'measured', 'effect'] as const).map((h) => (
                  <TableHead key={h}>{t(`spares.head.${h}`)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 10 }, (_, i) => (
                <TableRow key={i}>
                  {(['test', 'proves', 'measured', 'effect'] as const).map((h) => (
                    <TableCell key={h} className="align-top whitespace-normal">
                      {t(`spares.r${i}.${h}`)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm text-muted-foreground">{t('footnote')}</p>
      </section>
    </div>
  );
}

function EvidenceRow({
  what,
  desc,
  control,
  effect,
}: {
  what: string;
  desc: string;
  control: ReactNode;
  effect: Effect;
}) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,2fr)_auto_minmax(0,3fr)] md:items-center">
      <div>
        <p className="text-sm font-medium">{what}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div>{control}</div>
      <p className="text-sm" aria-live="polite">
        <StatusChip tone={effect.tone}>{effect.chip}</StatusChip> {effect.text}
      </p>
    </div>
  );
}

function PercentInput({
  label,
  value,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <NumberInput
        aria-label={label}
        value={value}
        min={0}
        max={100}
        step={step}
        normalize={percent}
        disabled={disabled}
        className="w-20"
        onValueChange={onChange}
      />
      <span className="text-sm text-muted-foreground">%</span>
    </span>
  );
}

function CheckLabel({
  label,
  name,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  /** The evidence row, so the accessible name is not just "In place". */
  name: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <span className="flex items-center gap-2">
      <Checkbox
        id={id}
        aria-label={`${name}: ${label}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </span>
  );
}
