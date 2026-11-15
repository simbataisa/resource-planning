'use client';

import type { TourEvent } from '@/lib/tours/types';
import { useTourEmit } from './tour-provider';

/**
 * Lets a screen tell the running tour that something happened (guided-tours spec 6.2), e.g. the
 * draft toolbar reports `version-saved` after a successful save. A no-op when no tour step waits
 * for that event, or outside a `TourProvider`.
 */
export function useTourEvent(): (event: TourEvent) => void {
  return useTourEmit();
}
