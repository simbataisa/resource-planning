'use client';

import { X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** A panel that slides in from an edge (shadcn Sheet on Radix Dialog): focus trapped, Escape closes. */
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

export function SheetContent({
  className,
  children,
  side = 'right',
  closeLabel,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'left' | 'right';
  /** Accessible name of the close button, translated by the caller. */
  closeLabel: string;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-black/50"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed inset-y-0 z-50 flex h-full w-3/4 flex-col gap-4 bg-popover text-popover-foreground shadow-card transition ease-in-out sm:max-w-sm',
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100">
          <X aria-hidden="true" className="size-4" />
          <span className="sr-only">{closeLabel}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
