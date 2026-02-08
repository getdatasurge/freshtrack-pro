import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, border, transition } from '@/lib/design-system/tokens';

export interface RadioGroupListOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupListProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  name: string;
  options: RadioGroupListOption[];
  value?: string;
  onChange?: (value: string) => void;
}

export const RadioGroupList = React.forwardRef<HTMLDivElement, RadioGroupListProps>(
  ({ className, name, options, value, onChange, ...props }, ref) => {
    return (
      <div ref={ref} role="radiogroup" className={cn('space-y-0 divide-y divide-zinc-800', className)} {...props}>
        {options.map((opt) => {
          const isSelected = value === opt.value;

          return (
            <label
              key={opt.value}
              className={cn(
                'flex items-center gap-3 py-3 cursor-pointer',
                transition.fast,
                opt.disabled && 'opacity-50 pointer-events-none',
              )}
            >
              <div className={cn(
                'h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                isSelected ? 'border-blue-500' : border.strong,
                transition.fast,
              )}>
                {isSelected && <div className="h-2 w-2 rounded-full bg-blue-500" />}
              </div>
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={isSelected}
                onChange={() => onChange?.(opt.value)}
                disabled={opt.disabled}
                className="sr-only"
              />
              <div>
                <div className={cn('text-sm font-medium', textTokens.primary)}>{opt.label}</div>
                {opt.description && (
                  <div className={cn('text-sm', textTokens.tertiary)}>{opt.description}</div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    );
  },
);
RadioGroupList.displayName = 'RadioGroupList';
