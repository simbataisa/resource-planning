import type { Me } from '@sit/schemas';
import type { TourDefinition, TourStep } from './types';

const hasRole = (me: Me, ...roles: string[]) => me.memberships.some((m) => roles.includes(m.role));
const isAdmin = (me: Me) => me.globalRole === 'ADMIN';

/** Routes are pathnames without the locale prefix. */
const PROJECTS = /^\/projects$/;
const PROJECT = /^\/projects\/[^/]+$/;
const ESTIMATE = /^\/estimates\/[^/]+$/;
const ANY = /^\//;

const tgt = (name: string) => `[data-tour="${name}"]`;

function step(
  route: RegExp,
  target: string,
  messageKey: string,
  advance: TourStep['advance'] = 'next',
  placement?: TourStep['placement'],
): TourStep {
  return { route, target, messageKey, advance, ...(placement ? { placement } : {}) };
}

const FE = 'tours.firstEstimate';
const RT = 'tours.readingTour';
const FA = 'tours.firstEstimateAdmin';

/** Every guided tour, in priority order within a kind (guided-tours spec 6.5). */
export const TOURS: TourDefinition[] = [
  {
    id: 'first-estimate@1',
    kind: 'onboarding',
    since: '2026-11-15T00:00:00.000Z',
    // Estimator or QE Lead in at least one project, or Admin (who can open every project).
    audience: (me) => isAdmin(me) || hasRole(me, 'ESTIMATOR', 'QE_LEAD'),
    steps: [
      step(PROJECTS, 'center', `${FE}.welcome`),
      step(PROJECTS, tgt('project-list'), `${FE}.projects`, 'navigate', 'top'),
      step(PROJECT, tgt('new-estimate'), `${FE}.newEstimate`, 'click', 'bottom'),
      step(PROJECT, tgt('estimate-name'), `${FE}.name`, { event: 'estimate-created' }, 'bottom'),
      step(ESTIMATE, tgt('tab-rough'), `${FE}.rough`, 'next', 'bottom'),
      step(ESTIMATE, tgt('tab-team'), `${FE}.team`, 'next', 'bottom'),
      step(ESTIMATE, tgt('summary-cards'), `${FE}.summary`, 'next', 'bottom'),
      step(ESTIMATE, tgt('gap-table'), `${FE}.gap`, 'next', 'top'),
      step(ESTIMATE, tgt('save-status'), `${FE}.autosave`, 'next', 'bottom'),
      step(ESTIMATE, tgt('save-version'), `${FE}.save`, { event: 'version-saved' }, 'bottom'),
      step(ESTIMATE, 'center', `${FE}.done`),
    ],
  },
  {
    id: 'first-estimate-admin@1',
    kind: 'onboarding',
    since: '2026-11-15T00:00:00.000Z',
    after: 'first-estimate@1',
    audience: isAdmin,
    steps: [
      step(ANY, tgt('nav-users'), `${FA}.users`, 'next', 'right'),
      step(ANY, tgt('nav-audit'), `${FA}.audit`, 'next', 'right'),
      step(ANY, tgt('nav-profiles'), `${FA}.profiles`, 'next', 'right'),
    ],
  },
  {
    id: 'reading-tour@1',
    kind: 'onboarding',
    since: '2026-11-15T00:00:00.000Z',
    // Viewer only: no Estimator or QE Lead role anywhere.
    audience: (me) => hasRole(me, 'VIEWER') && !hasRole(me, 'ESTIMATOR', 'QE_LEAD'),
    steps: [
      step(PROJECTS, tgt('project-list'), `${RT}.project`, 'navigate', 'top'),
      step(PROJECT, tgt('estimate-list'), `${RT}.estimate`, 'navigate', 'top'),
      step(ESTIMATE, tgt('summary-cards'), `${RT}.summary`, 'next', 'bottom'),
      step(ESTIMATE, tgt('gap-table'), `${RT}.gap`, 'next', 'top'),
      step(ESTIMATE, tgt('export-panel'), `${RT}.export`, 'next', 'top'),
      step(ESTIMATE, 'center', `${RT}.done`),
    ],
  },
  {
    id: 'no-project@1',
    kind: 'onboarding',
    since: '2026-11-15T00:00:00.000Z',
    // In no project and not Admin. Closing it records `dismissed`, never `completed`.
    audience: (me) => me.memberships.length === 0 && !isAdmin(me),
    steps: [step(ANY, 'center', 'tours.noProject.card')],
  },
];
