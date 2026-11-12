'use client';

import type { ReactNode } from 'react';
import { Field } from './field';
import { NumberInput } from './number-input';

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
  disabled?: boolean;
  /** See NumberInput. */
  normalize?: (n: number) => number;
  className?: string;
}

/** Labelled number input for the estimate editor; see NumberInput for the parsing rules. */
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
  disabled,
  normalize,
  className,
}: NumberFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(control) => (
        <div className="flex items-center gap-2">
          <NumberInput
            {...control}
            value={value}
            onValueChange={onChange}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            normalize={normalize}
            className="w-28"
          />
          {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
        </div>
      )}
    </Field>
  );
}
