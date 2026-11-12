'use client';

import type { ComponentProps } from 'react';
import { useScrollTabStop } from '@/lib/use-scroll-tab-stop';
import { cn } from '@/lib/utils';

/**
 * Plain table primitives; the wrapper scrolls horizontally on narrow screens and is a
 * tab stop while it overflows (useScrollTabStop).
 */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  const { ref, tabIndex } = useScrollTabStop<HTMLDivElement>();
  return (
    <div
      ref={ref}
      data-slot="table-container"
      tabIndex={tabIndex}
      className="relative w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring"
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

export function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t border-border-strong font-bold', className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn('border-b transition-colors hover:bg-muted/50', className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        // The prototype's table heads: small caps on the sunk grey.
        'h-9 bg-muted px-2.5 text-left align-middle text-[0.74rem] font-semibold tracking-[0.06em] whitespace-normal text-muted-foreground uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('px-2.5 py-[7px] align-middle', className)}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
