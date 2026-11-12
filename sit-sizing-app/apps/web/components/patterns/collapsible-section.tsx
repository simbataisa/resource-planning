'use client';

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CollapsibleSectionProps {
  title: string;
  /** Optional number shown before the title, e.g. the prototype's numbered sections. */
  index?: number;
  /** One-line live summary shown next to the title, e.g. "34 APIs · 16 screens". */
  summary?: ReactNode;
  /** Greyed out when the section has nothing in scope. */
  empty?: boolean;
  defaultOpen?: boolean;
  /** Controlled open state (use with onToggle), e.g. for "expand all". */
  open?: boolean;
  id?: string;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

/**
 * The prototype's collapsible "Detailed scope" sections, on native <details>/<summary>:
 * keyboard and screen-reader support come from the browser.
 */
export function CollapsibleSection({
  title,
  index,
  summary,
  empty,
  defaultOpen,
  open,
  id,
  onToggle,
  children,
  className,
}: CollapsibleSectionProps) {
  return (
    <details
      id={id}
      open={open ?? defaultOpen}
      onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}
      className={cn(
        'group scroll-mt-4 rounded-lg border bg-card',
        empty && 'opacity-70',
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open:rotate-90"
        />
        {index !== undefined ? (
          <span
            aria-hidden="true"
            className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold"
          >
            {index}
          </span>
        ) : null}
        <span className="font-medium">{title}</span>
        {summary ? <span className="ml-auto text-sm text-muted-foreground">{summary}</span> : null}
      </summary>
      <div className="grid gap-4 border-t px-4 py-4">{children}</div>
    </details>
  );
}
