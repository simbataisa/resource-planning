'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/** Controls that can take keyboard focus; disabled ones cannot. */
const FOCUSABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

/**
 * Makes a horizontally scrolling box a tab stop while it overflows, so keyboard users can
 * scroll it (WCAG 2.1.1, axe scrollable-region-focusable). A box that fits, or that already
 * contains an enabled control, adds no tab stop. Rechecks on resize and when its content or
 * its controls' disabled state changes (for example a version becoming read-only).
 */
export function useScrollTabStop<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () =>
      setOverflows(el.scrollWidth > el.clientWidth && !el.querySelector(FOCUSABLE));
    check();
    const cleanups: (() => void)[] = [];
    if (typeof ResizeObserver !== 'undefined') {
      const resize = new ResizeObserver(check);
      resize.observe(el);
      cleanups.push(() => resize.disconnect());
    }
    if (typeof MutationObserver !== 'undefined') {
      const mutation = new MutationObserver(check);
      mutation.observe(el, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['disabled', 'href', 'tabindex', 'contenteditable'],
      });
      cleanups.push(() => mutation.disconnect());
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
  return { ref, tabIndex: overflows ? 0 : undefined };
}
