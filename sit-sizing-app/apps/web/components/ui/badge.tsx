import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  // The prototype's chips: pill-shaped, small monospace caps.
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.72rem] font-semibold tracking-[0.04em] whitespace-nowrap [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        good: 'border-transparent bg-good-soft text-good',
        warn: 'border-transparent bg-warn-soft text-warn',
        /** "Uncalibrated": dashed, as in the prototype. */
        unc: 'border-dashed border-warn/60 bg-warn-soft text-warn',
        /** "Team value". */
        team: 'border-good/40 bg-good-soft text-good',
        bad: 'border-transparent bg-bad-soft text-bad',
        rough: 'border-transparent bg-rough-soft text-rough-foreground',
        detailed: 'border-transparent bg-detailed-soft text-detailed-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
