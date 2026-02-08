import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, transition } from '@/lib/design-system/tokens';
import { Minus, Plus } from 'lucide-react';

export interface NumberStepperProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export const NumberStepper = React.forwardRef<HTMLDivElement, NumberStepperProps>(
  ({ className, value, onChange, min, max, step = 1, disabled, ...props }, ref) => {
    const canDecrement = min === undefined || value - step >= min;
    const canIncrement = max === undefined || value + step <= max;

    return (
      <div
        ref={ref}
        className={cn('inline-flex items-center border rounded-lg', border.strong, surface.raised, className)}
        {...props}
      >
        <button
          type="button"
          onClick={() => canDecrement && onChange(value - step)}
          disabled={disabled || !canDecrement}
          className={cn(
            'px-2.5 py-1.5',
            textTokens.secondary,
            'hover:bg-zinc-800',
            transition.fast,
            'disabled:opacity-50 disabled:pointer-events-none',
            'rounded-l-lg border-r',
            border.strong,
          )}
          aria-label="Decrease"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className={cn('px-4 py-1.5 text-sm font-medium tabular-nums min-w-[3rem] text-center', textTokens.primary)}>
          {value}
        </span>
        <button
          type="button"
          onClick={() => canIncrement && onChange(value + step)}
          disabled={disabled || !canIncrement}
          className={cn(
            'px-2.5 py-1.5',
            textTokens.secondary,
            'hover:bg-zinc-800',
            transition.fast,
            'disabled:opacity-50 disabled:pointer-events-none',
            'rounded-r-lg border-l',
            border.strong,
          )}
          aria-label="Increase"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  },
);
NumberStepper.displayName = 'NumberStepper';
