import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, radius, transition } from '@/lib/design-system/tokens';
import { Search, X } from 'lucide-react';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
  shortcut?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onClear, shortcut, ...props }, ref) => {
    const hasValue = value && String(value).length > 0;

    return (
      <div className="relative">
        <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4', textTokens.tertiary)} />
        <input
          ref={ref}
          type="search"
          value={value}
          className={cn(
            'w-full pl-9 pr-9 py-2 text-sm',
            surface.raised,
            'border',
            border.strong,
            radius.md,
            textTokens.primary,
            'placeholder:text-zinc-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
            transition.fast,
            '[&::-webkit-search-cancel-button]:hidden',
            className,
          )}
          {...props}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {hasValue && onClear && (
            <button type="button" onClick={onClear} className={cn('p-0.5 rounded hover:bg-zinc-800', transition.fast)} aria-label="Clear search">
              <X className={cn('h-3.5 w-3.5', textTokens.tertiary)} />
            </button>
          )}
          {shortcut && !hasValue && (
            <kbd className="text-[10px] font-mono text-zinc-600 border border-zinc-800 rounded px-1 py-0.5">{shortcut}</kbd>
          )}
        </div>
      </div>
    );
  },
);
SearchInput.displayName = 'SearchInput';
