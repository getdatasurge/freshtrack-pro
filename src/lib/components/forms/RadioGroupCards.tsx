import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, transition, radius } from '@/lib/design-system/tokens';

export interface RadioGroupCardsOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupCardsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  name: string;
  options: RadioGroupCardsOption[];
  value?: string;
  onChange?: (value: string) => void;
  cols?: 2 | 3 | 4;
}

const colClasses = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
} as const;

export const RadioGroupCards = React.forwardRef<HTMLDivElement, RadioGroupCardsProps>(
  ({ className, name, options, value, onChange, cols = 3, ...props }, ref) => {
    return (
      <div ref={ref} role="radiogroup" className={cn('grid gap-3', colClasses[cols], className)} {...props}>
        {options.map((opt) => {
          const isSelected = value === opt.value;

          return (
            <label
              key={opt.value}
              className={cn(
                'relative flex items-start gap-3 border p-4 cursor-pointer',
                radius.lg,
                transition.fast,
                isSelected
                  ? 'bg-blue-500/10 border-blue-500/30 ring-2 ring-blue-500/20'
                  : `${surface.raised} ${border.default} hover:border-zinc-700`,
                opt.disabled && 'opacity-50 pointer-events-none',
              )}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={isSelected}
                onChange={() => onChange?.(opt.value)}
                disabled={opt.disabled}
                className="sr-only"
              />
              {opt.icon && (
                <div className={cn('flex-shrink-0 mt-0.5 [&_svg]:h-5 [&_svg]:w-5', isSelected ? 'text-blue-400' : textTokens.tertiary)}>
                  {opt.icon}
                </div>
              )}
              <div>
                <div className={cn('text-sm font-medium', isSelected ? 'text-blue-400' : textTokens.primary)}>
                  {opt.label}
                </div>
                {opt.description && (
                  <div className={cn('text-sm mt-0.5', textTokens.tertiary)}>{opt.description}</div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    );
  },
);
RadioGroupCards.displayName = 'RadioGroupCards';
