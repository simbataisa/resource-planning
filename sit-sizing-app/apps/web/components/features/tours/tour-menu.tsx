'use client';

import { useTranslations } from 'next-intl';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter } from '@/i18n/navigation';
import { useMe } from '@/lib/query/hooks';
import { TOURS } from '@/lib/tours/registry';
import { onboardingFor } from '@/lib/tours/select';
import { useTours } from './tour-provider';

/**
 * Starts the user's onboarding tour again. Step routes are patterns, so the tour restarts from
 * the projects list, which every onboarding tour can begin on (spec 6.6).
 */
function useTakeTour() {
  const { data: me } = useMe();
  const { start } = useTours();
  const router = useRouter();
  const tour = me ? onboardingFor(me, TOURS) : null;
  return tour
    ? () => {
        router.push('/projects');
        start(tour.id);
      }
    : null;
}

/** The "?" menu in the sidebar header: take the tour, or resume one that paused (spec 6.6). */
export function TourMenu() {
  const t = useTranslations('tours.controls');
  const { paused, resume } = useTours();
  const take = useTakeTour();
  if (!take && !paused) return null;
  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={t('menu')} data-tour="tour-menu">
                <HelpCircle aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">{t('menu')}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          {paused ? <DropdownMenuItem onSelect={resume}>{t('resume')}</DropdownMenuItem> : null}
          {take ? <DropdownMenuItem onSelect={take}>{t('take')}</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

/** "Take the tour" at the top of the Guide page. */
export function TakeTourButton() {
  const t = useTranslations('tours.controls');
  const take = useTakeTour();
  if (!take) return null;
  return (
    <div>
      <Button variant="outline" size="sm" onClick={take}>
        <HelpCircle aria-hidden="true" />
        {t('take')}
      </Button>
    </div>
  );
}
