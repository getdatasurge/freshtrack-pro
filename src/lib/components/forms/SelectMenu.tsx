import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, radius, transition } from '@/lib/design-system/tokens';
import { ChevronDown } from 'lucide-react';

export interface SelectMenuOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectMenuProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectMenuOption[];
  placeholder?: string;
  hasError?: boolean;
  label?: string;
}

export const SelectMenu = React.forwardRef<HTMLSelectElement, SelectMenuProps>(
  ({ className, options, placeholder, hasError, label, ...props }, ref) => {
    return (
      <div className="relative">
        {label && <label className="block text-sm font-medium text-zinc-400 mb-1">{label}</label>}
        <select
          ref={ref}
          className={cn(
            'w-full appearance-none px-3 py-2 pr-9 text-sm',
            surface.raised,
            'border',
            hasError ? 'border-red-500 ring-2 ring-red-500/30' : border.strong,
            radius.md,
            textTokens.primary,
            'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
            transition.fast,
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className={cn('absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none', textTokens.tertiary)}
        />
      </div>
    );
  },
);
SelectMenu.displayName = 'SelectMenu';
