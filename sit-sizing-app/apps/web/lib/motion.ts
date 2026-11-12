'use client';

import { motion } from '@sit/tokens';
import { animate } from 'animejs';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * The three anime.js hooks (design 3, 8): motion is optional polish, never needed to
 * understand the page, and switched off when the user prefers reduced motion.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
const getSnapshot = () =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY).matches : false;

/** True when the OS asks for reduced motion. Server render assumes reduced (no animation). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

/** Animates a number from its previous value to `target`; jumps straight there when motion is reduced. */
export function useCountUp(target: number, duration: number = motion.slow): number {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    if (reduced || from.current === target) {
      from.current = target;
      setShown(target);
      return;
    }
    const state = { value: from.current };
    const anim = animate(state, {
      value: target,
      duration,
      ease: 'outQuad',
      onUpdate: () => setShown(state.value),
      onComplete: () => {
        from.current = target;
      },
    });
    return () => {
      from.current = state.value;
      anim.pause();
    };
  }, [target, duration, reduced]);

  return shown;
}

/** Fades and lifts an element in once, on mount. Returns the ref to attach. */
export function useEnterAnimation<T extends HTMLElement>(duration: number = motion.base) {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (reduced || !ref.current) return;
    const anim = animate(ref.current, {
      opacity: [0, 1],
      translateY: [6, 0],
      duration,
      ease: 'outQuad',
    });
    return () => {
      anim.revert();
    };
  }, [reduced, duration]);
  return ref;
}
