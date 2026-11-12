'use client';

import { useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Field } from './field';

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Short unit after the input, e.g. "%", "h", "weeks". */
  unit?: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
}

/**
 * Number input for the estimate editor. Keeps what the user is typing (including an empty
 * box) and reports a number only when it parses and is within min/max, so partial input
 * never reaches the engine.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
  error,
  className,
}: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  // When the value changes from outside (e.g. reset), show it — unless the box already
  // holds the same number in another spelling ("6.0"). Adjusting state during render is
  // React's recommended alternative to an effect here.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (Number(text) !== value) setText(String(value));
  }

  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(control) => (
        <div className="flex items-center gap-2">
          <Input
            {...control}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={text}
            className={cn('w-28 text-right tabular-nums')}
            onChange={(e) => {
              const raw = e.target.value;
              setText(raw);
              if (raw.trim() === '') return;
              const n = Number(raw);
              if (!Number.isFinite(n)) return;
              if ((min !== undefined && n < min) || (max !== undefined && n > max)) return;
              onChange(n);
            }}
          />
          {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
        </div>
      )}
    </Field>
  );
}
