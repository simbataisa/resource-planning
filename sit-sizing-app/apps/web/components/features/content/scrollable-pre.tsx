'use client';

import type { ReactNode } from 'react';
import { useScrollTabStop } from '@/lib/use-scroll-tab-stop';

/** A preformatted block that scrolls sideways and is keyboard-scrollable while it overflows. */
export function ScrollablePre({ children }: { children: ReactNode }) {
  const { ref, tabIndex } = useScrollTabStop<HTMLPreElement>();
  return (
    <pre
      ref={ref}
      tabIndex={tabIndex}
      className="overflow-x-auto rounded-lg border bg-muted px-3.5 py-3 font-mono text-[0.86rem] leading-[1.7] focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </pre>
  );
}
