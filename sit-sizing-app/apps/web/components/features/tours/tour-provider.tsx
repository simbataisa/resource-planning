'use client';

import type { Me, TourStatus } from '@sit/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ACTIONS,
  EVENTS,
  Joyride,
  STATUS,
  type EventData,
  type Options,
  type Step,
} from 'react-joyride';
import { usePathname, useRouter } from '@/i18n/navigation';
import { usePrefersReducedMotion } from '@/lib/motion';
import { qk } from '@/lib/query/keys';
import { useMe, useSaveTours, useSyncTours } from '@/lib/query/hooks';
import { selectTour } from '@/lib/tours/select';
import { pendingSync, readLocal } from '@/lib/tours/storage';
import type { TourDefinition, TourEvent } from '@/lib/tours/types';
import { TourTooltip, type TourStepData } from './tour-tooltip';

/** sessionStorage key: the tour in progress, so it continues across pages and reloads. */
const PROGRESS_KEY = 'sit-tour-progress';
/** A step whose target does not appear within this time pauses the tour (spec 6.5). */
const TARGET_WAIT_MS = 5000;
/** Pages outside the signed-in area: no `/me` request there (a 401 would send the user to sign-in). */
const PUBLIC_PATHS = new Set(['/signed-out']);

/**
 * Tours that are only ever recorded as `dismissed`, however they close, so they show again at the
 * next sign-in (spec 6.5: `no-project@1` until the user is added to a project).
 */
const DISMISS_ONLY = new Set(['no-project@1']);
const closeStatus = (id: string, wanted: TourStatus): TourStatus =>
  DISMISS_ONLY.has(id) ? 'dismissed' : wanted;

interface Progress {
  id: string;
  stepIndex: number;
  paused: boolean;
  /** Last page the tour was shown on; Resume goes back there. */
  path?: string;
  /** Already recorded (`version-saved`); closing the Done card records nothing more. */
  recorded?: boolean;
}

function readProgress(): Progress | null {
  try {
    const raw = window.sessionStorage.getItem(PROGRESS_KEY);
    const p = raw === null ? null : (JSON.parse(raw) as Progress);
    return p && typeof p.id === 'string' && Number.isInteger(p.stepIndex) ? p : null;
  } catch {
    return null;
  }
}

function writeProgress(p: Progress | null): void {
  try {
    if (p) window.sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    else window.sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // Storage blocked: the tour still runs on this page, it just does not survive a reload.
  }
}

/** Joyride step options; motion is off when the user prefers reduced motion (spec 6.7). */
export function joyrideOptions(reducedMotion: boolean): Partial<Options> {
  return {
    skipBeacon: true,
    targetWaitTimeout: TARGET_WAIT_MS,
    overlayClickAction: false,
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    scrollDuration: reducedMotion ? 0 : 300,
    zIndex: 60,
  };
}

const NO_MOTION = {
  floater: { transition: 'none' },
  overlay: { transition: 'none' },
};
const NoLoader = () => null;

interface TourContextValue {
  active: TourDefinition | null;
  paused: boolean;
  start(id: string): void;
  resume(): void;
  emit(event: TourEvent): void;
}

const noop = () => {};
const OUTSIDE: TourContextValue = {
  active: null,
  paused: false,
  start: noop,
  resume: noop,
  emit: noop,
};
const TourContext = createContext<TourContextValue>(OUTSIDE);

/** The current tour and its entry points. Outside a provider it is inert. */
export function useTours(): Omit<TourContextValue, 'emit'> {
  const { active, paused, start, resume } = useContext(TourContext);
  return { active, paused, start, resume };
}

/** @internal Used by `useTourEvent`. */
export const useTourEmit = () => useContext(TourContext).emit;

/**
 * Runs guided tours (guided-tours spec 6): picks a tour when `/me` loads or the page changes,
 * keeps progress in sessionStorage, renders React Joyride in controlled mode, and records how
 * the tour closed optimistically through `useSaveTours`.
 */
export function TourProvider({
  registry,
  children,
}: {
  registry: TourDefinition[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const reducedMotion = usePrefersReducedMotion();
  const qc = useQueryClient();
  const { data: me } = useMe(!PUBLIC_PATHS.has(pathname));
  const save = useSaveTours();
  const sync = useSyncTours();

  const [progress, setProgressState] = useState<Progress | null>(null);
  const [restored, setRestored] = useState(false);
  // Callbacks read the latest progress and page through refs: Joyride and screens call them
  // between renders. `setProgress` is the only writer of `progressRef`.
  const progressRef = useRef(progress);
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const setProgress = useCallback((p: Progress | null) => {
    progressRef.current = p;
    setProgressState(p);
    writeProgress(p);
  }, []);

  const tour = progress ? (registry.find((x) => x.id === progress.id) ?? null) : null;
  const step = tour && progress ? tour.steps[progress.stepIndex] : undefined;
  const run = !!me && !!step && !progress?.paused && step.route.test(pathname);

  // Continue a tour from an earlier page load; paused when this page is not its step's page.
  useEffect(() => {
    const p = readProgress();
    const def = p ? registry.find((x) => x.id === p.id) : undefined;
    const s = def?.steps[p!.stepIndex];
    if (p && s) setProgress({ ...p, paused: p.paused || !s.route.test(pathRef.current) });
    setRestored(true);
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resend browser-copy entries the server lacks (a failed save on an earlier page).
  const syncedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!me || syncedFor.current === me.id) return;
    syncedFor.current = me.id;
    const pending = pendingSync(me, readLocal(me.id));
    if (Object.keys(pending).length > 0) sync.mutate(pending);
  }, [me, sync]);

  // At most one automatic start per page: when /me loads or the page changes.
  const autoFor = useRef<string | null>(null);
  const meId = me?.id;
  useEffect(() => {
    const current = qc.getQueryData<Me>(qk.me);
    if (!restored || !current || progressRef.current || autoFor.current === pathname) return;
    autoFor.current = pathname;
    const next = selectTour(current, pathname, registry, readLocal(current.id));
    // Starting a tour reacts to /me and the page (external state), so it belongs in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next) setProgress({ id: next.id, stepIndex: 0, paused: false, path: pathname });
  }, [meId, pathname, registry, restored, qc, setProgress]);

  // Page change during a tour: stay, move to the next step's page, or pause (spec 6.5).
  useEffect(() => {
    const p = progressRef.current;
    const def = p && registry.find((x) => x.id === p.id);
    if (!p || p.paused || !def) return;
    const here = def.steps[p.stepIndex];
    const next = def.steps[p.stepIndex + 1];
    if (here?.route.test(pathname)) {
      if (p.path !== pathname) setProgress({ ...p, path: pathname });
    } else if (here && here.advance !== 'next' && next?.route.test(pathname)) {
      setProgress({ ...p, stepIndex: p.stepIndex + 1, path: pathname });
    } else {
      setProgress({ ...p, paused: true });
    }
    // Only a page change should run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const record = useCallback(
    (id: string, wanted: TourStatus) => {
      const status = closeStatus(id, wanted);
      const current = qc.getQueryData<Me>(qk.me);
      if (status === 'dismissed' && current) {
        // A replay closed with ✕ does not undo an earlier completed or skipped.
        const local = readLocal(current.id);
        const done = [current.tours[id], local[id]].some(
          (e) => e?.status === 'completed' || e?.status === 'skipped',
        );
        if (done) return;
      }
      save.mutate({ [id]: { status } });
    },
    [qc, save],
  );

  const finish = useCallback(
    (status: TourStatus) => {
      const p = progressRef.current;
      if (!p) return;
      if (!p.recorded) record(p.id, status);
      setProgress(null);
    },
    [record, setProgress],
  );

  const goTo = useCallback(
    (stepIndex: number, extra: Partial<Progress> = {}) => {
      const p = progressRef.current;
      const def = p && registry.find((x) => x.id === p.id);
      if (!p || !def) return;
      if (stepIndex >= def.steps.length) finish('completed');
      else setProgress({ ...p, ...extra, stepIndex: Math.max(0, stepIndex) });
    },
    [finish, registry, setProgress],
  );

  const pause = useCallback(() => {
    const p = progressRef.current;
    if (p) setProgress({ ...p, paused: true });
  }, [setProgress]);

  const resume = useCallback(() => {
    const p = progressRef.current;
    const def = p && registry.find((x) => x.id === p.id);
    if (!p || !def) return;
    setProgress({ ...p, paused: false });
    const s = def.steps[p.stepIndex];
    if (s && !s.route.test(pathRef.current) && p.path) router.push(p.path);
  }, [registry, router, setProgress]);

  const start = useCallback(
    (id: string) => {
      if (!registry.some((x) => x.id === id)) return;
      setProgress({ id, stepIndex: 0, paused: false, path: pathRef.current });
    },
    [registry, setProgress],
  );

  const emit = useCallback(
    (event: TourEvent) => {
      const p = progressRef.current;
      const def = p && registry.find((x) => x.id === p.id);
      const s = def?.steps[p!.stepIndex];
      if (!p || p.paused || !s || typeof s.advance !== 'object' || s.advance.event !== event) {
        return;
      }
      if (event === 'version-saved') {
        // Spec 6.5 "Finishing": record completed first, then show the Done card.
        record(p.id, 'completed');
      }
      goTo(p.stepIndex + 1, event === 'version-saved' ? { recorded: true } : {});
    },
    [goTo, record, registry],
  );

  // A `click` step moves on when its target is clicked.
  useEffect(() => {
    if (!run || !step || step.advance !== 'click' || step.target === 'center') return;
    const selector = step.target;
    const index = progress!.stepIndex;
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest(selector)) goTo(index + 1);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [run, step, progress, goTo]);

  const onEvent = useCallback(
    (data: EventData) => {
      const p = progressRef.current;
      if (!p) return;
      if (data.type === EVENTS.TARGET_NOT_FOUND) pause();
      else if (data.type === EVENTS.TOUR_END && data.status === STATUS.SKIPPED) finish('skipped');
      else if (data.type === EVENTS.STEP_AFTER) {
        if (data.action === ACTIONS.NEXT) goTo(p.stepIndex + 1);
        else if (data.action === ACTIONS.PREV) goTo(p.stepIndex - 1);
        else if (data.action === ACTIONS.CLOSE) finish('dismissed');
      }
    },
    [finish, goTo, pause],
  );

  const recorded = !!progress?.recorded;
  const steps = useMemo<Step[]>(
    () =>
      (tour?.steps ?? []).map((s) => ({
        target: s.target === 'center' ? 'body' : s.target,
        placement: s.target === 'center' ? 'center' : (s.placement ?? 'bottom'),
        title: t(`${s.messageKey}.title`),
        content: t(`${s.messageKey}.body`),
        // Steps that wait for the page (click, event, navigate) must let keyboard users leave the
        // tooltip and reach the target, so Joyride's focus trap is off there (WCAG 2.1.1).
        disableFocusTrap: s.advance !== 'next',
        data: {
          advance: typeof s.advance === 'object' ? 'event' : s.advance,
          recorded,
          target: s.target === 'center' ? null : s.target,
        } satisfies TourStepData,
      })),
    [tour, t, recorded],
  );
  const options = useMemo(() => joyrideOptions(reducedMotion), [reducedMotion]);

  return (
    <TourContext.Provider value={{ active: tour, paused: !!progress?.paused, start, resume, emit }}>
      {children}
      {run && tour && (
        <Joyride
          key={tour.id}
          run
          continuous
          stepIndex={progress!.stepIndex}
          steps={steps}
          options={options}
          styles={reducedMotion ? NO_MOTION : undefined}
          floatingOptions={{ hideArrow: true }}
          tooltipComponent={TourTooltip}
          loaderComponent={NoLoader}
          onEvent={onEvent}
        />
      )}
    </TourContext.Provider>
  );
}
