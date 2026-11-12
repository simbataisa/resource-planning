import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The prototype's red caption above a heading, with a short red rule before it. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'flex items-center gap-2.5 text-[0.78rem] font-semibold tracking-[2px] text-brand uppercase',
        className,
      )}
    >
      <span aria-hidden="true" className="inline-block h-0.5 w-[18px] bg-brand" />
      {children}
    </p>
  );
}
