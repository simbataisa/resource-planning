'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface CollapsibleSectionProps {
  title: string;
  /**
   * `section`: the prototype's numbered Detailed scope sections (white card, grey header when
   * open, red number). `box`: the prototype's grey "rubric box" with a red title, used for
   * guide topics and optional detail.
   */
  variant?: 'section' | 'box';
  /** Optional number shown before the title (section variant). */
  index?: number;
  /** One-line live summary shown on the right, e.g. "34 APIs · 16 screens". */
  summary?: ReactNode;
  /** Nothing in scope: the number turns grey and the section dims. */
  empty?: boolean;
  defaultOpen?: boolean;
  /** Controlled open state (use with onToggle), e.g. for "expand all". */
  open?: boolean;
  id?: string;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

/** Collapsible block on native <details>/<summary>: keyboard and screen-reader support come from the browser. */
export function CollapsibleSection({
  title,
  variant = 'section',
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
  const toggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => onToggle?.(e.currentTarget.open);

  if (variant === 'box') {
    return (
      <details
        id={id}
        open={open ?? defaultOpen}
        onToggle={toggle}
        className={cn('group rounded-lg border bg-muted px-3.5 py-2.5', className)}
      >
        <summary className="cursor-pointer font-semibold text-brand group-open:mb-2">
          {title}
        </summary>
        <div className="grid gap-3">{children}</div>
      </details>
    );
  }

  return (
    <details
      id={id}
      open={open ?? defaultOpen}
      onToggle={toggle}
      className={cn('group scroll-mt-4 rounded-[10px] border bg-card shadow-card', className)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-[10px] px-4 py-3 select-none group-open:rounded-b-none group-open:border-b group-open:bg-muted hover:bg-muted [&::-webkit-details-marker]:hidden">
        {index !== undefined ? (
          <span
            aria-hidden="true"
            className={cn(
              'inline-grid size-[26px] flex-none place-items-center rounded-full font-mono text-[0.8rem] font-bold',
              empty ? 'bg-border-strong text-foreground' : 'bg-brand text-brand-foreground',
            )}
          >
            {index}
          </span>
        ) : null}
        <span className="font-semibold">{title}</span>
        {summary ? (
          <span className="ml-auto text-right font-mono text-[0.8rem] font-medium text-muted-foreground max-sm:hidden">
            {summary}
          </span>
        ) : (
          <span className="ml-auto" />
        )}
        <span
          aria-hidden="true"
          className="ml-1 size-2 flex-none -rotate-45 border-r-2 border-b-2 border-muted-foreground transition-transform group-open:rotate-45"
        />
      </summary>
      <div className="grid min-w-0 gap-3.5 px-4 pt-3.5 pb-[18px]">{children}</div>
    </details>
  );
}
