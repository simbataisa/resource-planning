'use client';

import { useLayoutEffect, useRef, useState } from 'react';

const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * Makes a horizontally scrolling box a tab stop while it overflows, so keyboard users can
 * scroll it (WCAG 2.1.1, axe scrollable-region-focusable). A box that fits, or that already
 * contains a focusable control, adds no tab stop.
 */
export function useScrollTabStop<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A box that already holds a control is reachable through it: no extra, unnamed stop.
    const check = () =>
      setOverflows(el.scrollWidth > el.clientWidth && !el.querySelector(FOCUSABLE));
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, tabIndex: overflows ? 0 : undefined };
}
