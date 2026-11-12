'use client';

import { cn } from '@/lib/utils';

export interface LangOption {
  value: string;
  /** Short label on the button, e.g. "EN". */
  label: string;
  /** Full name in that language, e.g. "Tiếng Việt" (tooltip and accessible name). */
  title: string;
}

export interface LangSwitchProps {
  /** Group label, e.g. "Language". */
  label: string;
  value: string;
  options: readonly LangOption[];
  onChange: (value: string) => void;
  className?: string;
}

/** The prototype's EN | VI toggle: a group of pressed/unpressed buttons. */
export function LangSwitch({ label, value, options, onChange, className }: LangSwitchProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex rounded-md border bg-card p-0.5', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            lang={o.value}
            title={o.title}
            aria-label={o.title}
            aria-pressed={active}
            onClick={() => !active && onChange(o.value)}
            className={cn(
              'rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
