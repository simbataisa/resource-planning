'use client';

import { useTranslations } from 'next-intl';
import { ASSUMPTION_PATHS, topGap, type ModeResult } from '@sit/engine';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/patterns/stat-card';
import { formatFte, formatInt, signed } from '@/lib/format';
import { useEditor } from './store';

/** The four headline cards (prototype `#summary`): rough, detailed, gap and calibration. */
export function SummaryCards() {
  const t = useTranslations('editor.summary');
  const tg = useTranslations('catalogue.groups');
  const { results, uncalibrated, state } = useEditor();
  const { rough: R, detailed: D } = results;
  const weeks = state.inputs.team.weeks;
  const total = ASSUMPTION_PATHS.length;
  const gapF = D.fte - R.fte;
  const gapC = D.cases - R.cases;
  const top = topGap(results);
  const pct = R.cases
    ? `${gapC >= 0 ? '+' : '−'}${Math.round((Math.abs(gapC) / R.cases) * 100)}%`
    : '';

  const modeCard = (label: string, tone: 'rough' | 'detailed', o: ModeResult) => (
    <StatCard
      label={label}
      value={o.fte}
      unit={t('fte')}
      tone={tone}
      format={formatFte}
      range={t('range', { lo: formatFte(o.lo), hi: formatFte(o.hi), b: Math.round(o.band * 100) })}
      detail={t('detail', { c: formatInt(o.cases), h: formatInt(o.hours), w: weeks })}
    />
  );

  let driver = t('agree');
  if (top) {
    const label = tg(top.group);
    // The prototype picks "drive" for plural labels ("Screens") and "drives" otherwise.
    driver = t(/s$/.test(label) ? 'drivesMany' : 'drivesOne', { label, p: top.share });
  }

  return (
    <section
      aria-label={t('label')}
      aria-live="polite"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {modeCard(t('rough'), 'rough', R)}
      {modeCard(t('detailed'), 'detailed', D)}
      <StatCard
        label={t('gap')}
        value={gapF}
        unit={t('fte')}
        format={(n) => signed(n)}
        range={t('gapCases', { s: gapC >= 0 ? '+' : '−', c: formatInt(Math.abs(gapC)), p: pct })}
        detail={driver}
      />
      <Card className="relative gap-2 px-5">
        <p className="text-sm font-medium text-muted-foreground">{t('calibration')}</p>
        <p className="text-3xl font-semibold tabular-nums">
          {uncalibrated}
          <small className="ml-1 text-base font-normal text-muted-foreground">
            {t('of', { n: total })}
          </small>
        </p>
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-warn"
            style={{ width: `${(uncalibrated / total) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t('uncalibrated')}</p>
      </Card>
    </section>
  );
}
