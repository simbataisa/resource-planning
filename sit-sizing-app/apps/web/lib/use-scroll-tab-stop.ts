'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Makes a horizontally scrolling box a tab stop while it overflows, so keyboard users can
 * scroll it (WCAG 2.1.1, axe scrollable-region-focusable). A box that fits adds no tab stop.
 */
export function useScrollTabStop<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, tabIndex: overflows ? 0 : undefined };
}
