import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, border, transition } from '@/lib/design-system/tokens';
import { Check, Minus } from 'lucide-react';

export interface CheckboxGroupOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface CheckboxGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: CheckboxGroupOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  selectAll?: boolean;
  selectAllLabel?: string;
}

export const CheckboxGroup = React.forwardRef<HTMLDivElement, CheckboxGroupProps>(
  ({ className, options, selected, onChange, selectAll = false, selectAllLabel = 'Select all', ...props }, ref) => {
    const allSelected = options.every((o) => selected.includes(o.value));
    const someSelected = options.some((o) => selected.includes(o.value));

    const toggleOne = (value: string) => {
      const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
      onChange(next);
    };

    const toggleAll = () => {
      if (allSelected) {
        onChange([]);
      } else {
        onChange(options.filter((o) => !o.disabled).map((o) => o.value));
      }
    };

    const renderCheckbox = (checked: boolean, indeterminate?: boolean) => (
      <div
        className={cn(
          'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
          transition.fast,
          checked || indeterminate
            ? 'bg-blue-600 border-blue-600'
            : `bg-transparent ${border.strong}`,
        )}
      >
        {checked && <Check className="h-3 w-3 text-white" />}
        {indeterminate && !checked && <Minus className="h-3 w-3 text-white" />}
      </div>
    );

    return (
      <div ref={ref} className={cn('space-y-0', className)} {...props}>
        {selectAll && (
          <label className={cn('flex items-center gap-3 py-2 cursor-pointer border-b', border.default, 'mb-1')}>
            {renderCheckbox(allSelected, someSelected && !allSelected)}
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="sr-only"
            />
            <span className={cn('text-sm font-medium', textTokens.primary)}>{selectAllLabel}</span>
          </label>
        )}
        {options.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'flex items-start gap-3 py-2 cursor-pointer',
              opt.disabled && 'opacity-50 pointer-events-none',
            )}
          >
            {renderCheckbox(selected.includes(opt.value))}
            <input
              type="checkbox"
              value={opt.value}
              checked={selected.includes(opt.value)}
              onChange={() => toggleOne(opt.value)}
              disabled={opt.disabled}
              className="sr-only"
            />
            <div>
              <div className={cn('text-sm', textTokens.primary)}>{opt.label}</div>
              {opt.description && <div className={cn('text-xs mt-0.5', textTokens.tertiary)}>{opt.description}</div>}
            </div>
          </label>
        ))}
      </div>
    );
  },
);
CheckboxGroup.displayName = 'CheckboxGroup';
