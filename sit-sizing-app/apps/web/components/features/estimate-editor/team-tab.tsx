'use client';

import { useTranslations } from 'next-intl';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Field } from '@/components/patterns/field';
import { NumberField } from '@/components/patterns/number-field';
import { atLeast0, atLeast1Int, percent } from '@/lib/clamp';
import { formatFte, formatInt } from '@/lib/format';
import { useEditor } from './store';
import { useCalendarText } from './use-calendar-text';

const LEVELS = ['junior', 'mid', 'senior'] as const;

/** Tab 3 (prototype `#p-team`): window, team mix, environment, AI help and the calendar check. */
export function TeamTab() {
  const t = useTranslations('teamTab');
  const tc = useTranslations('catalogue');
  const { state, results, editInputs, editable } = useEditor();
  const { inputs, assumptions: A } = state;
  const team = inputs.team;
  const { rough: R, detailed: D } = results;
  const mixTot =
    (Number(team.mix.junior) || 0) + (Number(team.mix.mid) || 0) + (Number(team.mix.senior) || 0);

  const envNote = [
    t('envNote', { env: tc(`env.${D.envI}`), f: D.env.toFixed(2) }),
    D.auto > 0
      ? t('autoOn', {
          a: Math.round(D.auto * 100),
          m: Math.round(A.regression * (1 - D.auto) * 100),
          r: Math.round(A.regression * 100),
        })
      : t('autoOff'),
  ].join(' ');

  const calendar = useCalendarText();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(18rem,24rem)]">
      <div className="grid content-start gap-5">
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <NumberField
            label={t('weeks')}
            value={team.weeks}
            min={1}
            normalize={atLeast0}
            disabled={!editable}
            onChange={(v) => editInputs((d) => void (d.team.weeks = v))}
          />
          <Field label={t('env')}>
            {(control) => (
              <NativeSelect
                {...control}
                className="min-w-64"
                value={String(team.env)}
                disabled={!editable}
                onChange={(e) =>
                  editInputs((d) => void (d.team.env = Number(e.target.value) as 0 | 1 | 2 | 3))
                }
              >
                {[0, 1, 2, 3].map((i) => (
                  <option key={i} value={i}>
                    {tc(`env.${i}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <NumberField
            label={t('automation')}
            value={team.automation}
            min={0}
            max={100}
            step={5}
            normalize={percent}
            disabled={!editable}
            onChange={(v) => editInputs((d) => void (d.team.automation = v))}
          />
          <Field label={t('ai')}>
            {(control) => (
              <NativeSelect
                {...control}
                className="min-w-40"
                value={String(team.ai ?? 0)}
                disabled={!editable}
                onChange={(e) =>
                  editInputs((d) => void (d.team.ai = Number(e.target.value) as 0 | 1 | 2))
                }
              >
                {[0, 1, 2].map((i) => (
                  <option key={i} value={i}>
                    {tc(`aiLevels.${i}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <NumberField
            label={t('aiIters')}
            value={team.aiIters}
            min={1}
            normalize={atLeast1Int}
            disabled={!editable}
            onChange={(v) => editInputs((d) => void (d.team.aiIters = v))}
          />
          <NumberField
            label={t('aiSmes')}
            value={team.aiSmes}
            min={1}
            normalize={atLeast1Int}
            disabled={!editable}
            onChange={(v) => editInputs((d) => void (d.team.aiSmes = v))}
          />
        </div>
        <h3 className="text-base font-semibold">{t('mix')}</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          {LEVELS.map((k) => (
            <NumberField
              key={k}
              label={t(k)}
              value={team.mix[k]}
              min={0}
              max={100}
              step={5}
              normalize={atLeast0}
              disabled={!editable}
              onChange={(v) => editInputs((d) => void (d.team.mix[k] = v))}
            />
          ))}
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <p>{mixTot === 100 ? t('mixOk') : t('mixNorm', { n: mixTot })}</p>
          <p>{envNote}</p>
          <p>
            {D.aiI > 0
              ? t('aiOn', { lvl: tc(`aiLevels.${D.aiI}`), p: Math.round(D.aiCut * 100) })
              : t('aiOff')}
          </p>
        </div>
        <h3 className="text-base font-semibold">{t('calendar')}</h3>
        <p className="rounded-md border-l-4 border-warn bg-warn-soft px-4 py-3 text-sm">
          {calendar || t('calNone')}
        </p>
      </div>
      <div className="grid content-start gap-3">
        <Stat label={t('hpf')}>
          {t('hpfValue', {
            h: formatInt(D.hpf),
            w: team.weeks,
            d: A.daysPerWeek,
            p: A.hoursPerDay,
          })}
        </Stat>
        <Stat label={t('blend')}>{`${D.blended.toFixed(2)} ×`}</Stat>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('level')}</TableHead>
                <TableHead className="text-right">{t('mixCol')}</TableHead>
                <TableHead className="text-right">{t('roughFte')}</TableHead>
                <TableHead className="text-right">{t('detailedFte')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LEVELS.map((k, i) => (
                <TableRow key={k}>
                  <TableCell>
                    {tc(`levels.${i}`)}{' '}
                    <span className="text-xs text-muted-foreground">({A.capacity[i]}×)</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {mixTot ? Math.round((team.mix[k] / mixTot) * 100) : 0}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatFte(R.levels[i]!)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatFte(D.levels[i]!)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell>{t('total')}</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">{formatFte(R.fte)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatFte(D.fte)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: string }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-muted/40 px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <b className="font-semibold tabular-nums">{children}</b>
    </div>
  );
}
