'use client';

import { useTranslations } from 'next-intl';
import { calendarChecks } from '@sit/engine';
import { formatInt, num1 } from '@/lib/format';
import { useEditor } from './store';

/** The calendar check text (prototype `#calNote`); empty when nothing is in scope. */
export function useCalendarText(): string {
  const t = useTranslations('teamTab');
  const { state, results } = useEditor();
  return calendarChecks(results, state.inputs, state.assumptions)
    .map((c) => {
      if (c.kind === 'data')
        return t(c.fits ? 'calDataFits' : 'calDataOver', {
          c: c.cycles,
          d: c.daysPerCycle,
          n: num1(c.daysNeeded),
          w: c.windowDays,
        });
      if (c.kind === 'ai')
        return `${t('calAi', {
          h: formatInt(c.smeLabelHours),
          d: num1(Math.round(c.days * 10) / 10),
          s: c.smes,
        })} ${c.fits ? t('calAiFits') : t('calAiOver', { w: num1(c.halfWindowDays) })}`;
      return (
        t('calPt', { c: c.cycles, d: c.daysPerCycle, n: num1(c.daysNeeded) }) +
        (c.fits ? '' : ` ${t('calPtOver')}`)
      );
    })
    .join(' ');
}
