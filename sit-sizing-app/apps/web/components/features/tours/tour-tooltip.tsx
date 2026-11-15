'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef } from 'react';
import type { TooltipRenderProps } from 'react-joyride';
import { Button } from '@/components/ui/button';

/** What the provider tells the tooltip about a step (Joyride `step.data`). */
export interface TourStepData {
  /** Only `next` steps show Next/Finish; the others wait for a click, a page or an event. */
  advance: 'next' | 'click' | 'navigate' | 'event';
  /** The tour was already recorded (Done card after `version-saved`): no Back, no Skip. */
  recorded: boolean;
}

/**
 * The tour step card (guided-tours spec 6.7): TCB-DS surface and buttons, next-intl strings,
 * `role="dialog"` labelled by the step title. Focus moves here when the step opens; Joyride's
 * focus trap keeps Tab inside and gives focus back to the page when the step closes.
 */
export function TourTooltip({
  index,
  size,
  isLastStep,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
}: TooltipRenderProps) {
  const t = useTranslations('tours.controls');
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const data = (step.data ?? { advance: 'next', recorded: false }) as TourStepData;

  useEffect(() => {
    const el = ref.current;
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [index]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body ${id}-progress`}
      tabIndex={-1}
      className="w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border bg-card p-4 text-left text-card-foreground shadow-card outline-none"
    >
      <div className="flex items-start gap-2">
        <h2 id={`${id}-title`} className="flex-1 text-base font-semibold">
          {step.title}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="-mt-1 -mr-1 size-8"
          aria-label={t('close')}
          data-action="close"
          onClick={closeProps.onClick}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div id={`${id}-body`} className="mt-2 text-sm">
        {step.content}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <p id={`${id}-progress`} className="text-xs text-muted-foreground" aria-live="polite">
          {t('progress', { current: index + 1, total: size })}
        </p>
        {!data.recorded && (
          <Button variant="link" size="sm" data-action="skip" onClick={skipProps.onClick}>
            {t('skip')}
          </Button>
        )}
        <span className="flex-1" />
        {index > 0 && !data.recorded && (
          <Button variant="outline" size="sm" data-action="back" onClick={backProps.onClick}>
            {t('back')}
          </Button>
        )}
        {data.advance === 'next' && (
          <Button size="sm" data-action="primary" onClick={primaryProps.onClick}>
            {isLastStep ? t('finish') : t('next')}
          </Button>
        )}
      </div>
    </div>
  );
}
