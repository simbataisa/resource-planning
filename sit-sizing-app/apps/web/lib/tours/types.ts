import type { Me } from '@sit/schemas';

/** App events a step can wait for before the tour moves on. */
export type TourEvent = 'estimate-created' | 'version-saved';

export interface TourStep {
  /** Matches the pathname without the locale prefix. */
  route: RegExp;
  /** CSS selector of the element to point at, or `'center'` for a centred card. */
  target: string | 'center';
  /** Key under `tours.*` in the message files. */
  messageKey: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  advance: 'next' | 'click' | 'navigate' | { event: TourEvent };
}

export interface TourDefinition {
  /** Tour key, e.g. `first-estimate@1` (see `TourKey`). */
  id: string;
  kind: 'onboarding' | 'feature';
  /** ISO date the tour shipped; a feature tour is offered only to users created before it. */
  since: string;
  /** Tour id that must be completed or skipped first. */
  after?: string;
  audience: (me: Me) => boolean;
  steps: TourStep[];
}
