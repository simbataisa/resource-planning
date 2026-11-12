'use client';

import { useSyncExternalStore } from 'react';

/** Below this width the sidebar becomes a slide-over sheet (shadcn's breakpoint). */
export const MOBILE_BREAKPOINT = 768;

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
const hasMatchMedia = () => typeof window !== 'undefined' && Boolean(window.matchMedia);

function subscribe(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

const snapshot = () => (hasMatchMedia() ? window.matchMedia(QUERY).matches : false);

/** True on phone-sized screens. False on the server and where matchMedia is missing. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
