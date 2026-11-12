'use client';

import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface NumberInputProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'min' | 'max'
> {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /**
   * Turns any finite number into the stored value (e.g. clamp and round), as the prototype
   * does. When given, min/max are only browser hints and out-of-range input is normalised
   * instead of ignored.
   */
  normalize?: (n: number) => number;
}

/**
 * Number input that keeps what the user is typing (including an empty box) and reports a
 * number only when it parses and is within min/max, so partial input never reaches the engine.
 * Give it a label (`aria-label` in tables, or wrap it in <Field>).
 */
export function NumberInput({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  normalize,
  className,
  ...props
}: NumberInputProps) {
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
    <Input
      {...props}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={text}
      className={cn('w-24 text-right tabular-nums', className)}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === '') return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        if (normalize) {
          onValueChange(normalize(n));
          return;
        }
        if ((min !== undefined && n < min) || (max !== undefined && n > max)) return;
        onValueChange(n);
      }}
    />
  );
}
