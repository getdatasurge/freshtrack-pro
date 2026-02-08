import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, radius, transition, zIndex } from '@/lib/design-system/tokens';
import { ChevronDown, Check } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ComboboxInputProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  hasError?: boolean;
}

export const ComboboxInput = React.forwardRef<HTMLDivElement, ComboboxInputProps>(
  ({ className, options, value, onChange, placeholder = 'Search...', hasError, ...props }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const containerRef = React.useRef<HTMLDivElement>(null);

    const filtered = React.useMemo(() => {
      if (!query) return options;
      return options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
    }, [options, query]);

    const selected = options.find((o) => o.value === value);

    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div ref={containerRef} className={cn('relative', className)} {...props}>
        <div
          className={cn(
            'flex items-center border',
            surface.raised,
            hasError ? 'border-red-500 ring-2 ring-red-500/30' : border.strong,
            radius.md,
            'focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500',
          )}
        >
          <input
            type="text"
            value={open ? query : selected?.label || ''}
            onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
            onFocus={() => { setOpen(true); setQuery(''); }}
            placeholder={placeholder}
            className={cn(
              'flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none',
              textTokens.primary,
              'placeholder:text-zinc-500',
            )}
          />
          <ChevronDown className={cn('mr-2 h-4 w-4 flex-shrink-0', textTokens.tertiary)} />
        </div>
        {open && filtered.length > 0 && (
          <div
            className={cn(
              'absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto border py-1',
              surface.overlay,
              border.default,
              radius.md,
              'shadow-lg shadow-black/40',
              zIndex.dropdown,
            )}
          >
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  onChange?.(opt.value);
                  setQuery('');
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                  transition.fast,
                  opt.value === value ? 'bg-zinc-800 text-zinc-50' : `${textTokens.secondary} hover:bg-zinc-800/50`,
                  'disabled:opacity-50',
                )}
              >
                <span className="flex-1">{opt.label}</span>
                {opt.value === value && <Check className="h-4 w-4 text-blue-400" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);
ComboboxInput.displayName = 'ComboboxInput';
