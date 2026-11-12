'use client';

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CollapsibleSectionProps {
  title: string;
  /** One-line live summary shown next to the title, e.g. "34 APIs · 16 screens". */
  summary?: ReactNode;
  /** Greyed out when the section has nothing in scope. */
  empty?: boolean;
  defaultOpen?: boolean;
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
  summary,
  empty,
  defaultOpen,
  id,
  onToggle,
  children,
  className,
}: CollapsibleSectionProps) {
  return (
    <details
      id={id}
      open={defaultOpen}
      onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}
      className={cn('group rounded-lg border bg-card', empty && 'opacity-70', className)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open:rotate-90"
        />
        <span className="font-medium">{title}</span>
        {summary ? (
          <span className="ml-auto truncate text-sm text-muted-foreground">{summary}</span>
        ) : null}
      </summary>
      <div className="border-t px-4 py-4">{children}</div>
    </details>
  );
}
