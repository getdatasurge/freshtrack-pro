import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, radius, transition, zIndex } from '@/lib/design-system/tokens';
import { CalendarDays } from 'lucide-react';
import { Calendar } from '../data-display/Calendar';

export interface DatePickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: Date;
  onChange?: (date: Date) => void;
  placeholder?: string;
  hasError?: boolean;
}

export const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>(
  ({ className, value, onChange, placeholder = 'Select date', hasError, ...props }, ref) => {
    const [open, setOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
            surface.raised,
            'border',
            hasError ? 'border-red-500 ring-2 ring-red-500/30' : border.strong,
            radius.md,
            transition.fast,
            value ? textTokens.primary : textTokens.tertiary,
            'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
          )}
        >
          <CalendarDays className="h-4 w-4 text-zinc-400" />
          {value ? value.toLocaleDateString() : placeholder}
        </button>
        {open && (
          <div
            className={cn(
              'absolute top-full left-0 mt-1 p-3 border',
              surface.overlay,
              border.default,
              radius.lg,
              'shadow-lg shadow-black/40',
              zIndex.dropdown,
            )}
          >
            <Calendar
              selected={value}
              onDateSelect={(date) => {
                onChange?.(date);
                setOpen(false);
              }}
            />
          </div>
        )}
      </div>
    );
  },
);
DatePicker.displayName = 'DatePicker';
