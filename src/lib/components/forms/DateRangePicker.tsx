import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, radius, transition, zIndex } from '@/lib/design-system/tokens';
import { CalendarDays } from 'lucide-react';
import { Calendar } from '../data-display/Calendar';

export interface DateRange {
  start: Date | undefined;
  end: Date | undefined;
}

export interface DateRangePickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  placeholder?: string;
  hasError?: boolean;
}

export const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>(
  ({ className, value, onChange, placeholder = 'Select date range', hasError, ...props }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [selecting, setSelecting] = React.useState<'start' | 'end'>('start');
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

    const handleSelect = (date: Date) => {
      if (selecting === 'start') {
        onChange?.({ start: date, end: undefined });
        setSelecting('end');
      } else {
        const start = value?.start;
        if (start && date >= start) {
          onChange?.({ start, end: date });
        } else {
          onChange?.({ start: date, end: undefined });
        }
        setSelecting('start');
        setOpen(false);
      }
    };

    const displayValue = value?.start
      ? `${value.start.toLocaleDateString()}${value.end ? ` - ${value.end.toLocaleDateString()}` : ' - ...'}`
      : null;

    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setSelecting('start'); }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
            surface.raised,
            'border',
            hasError ? 'border-red-500 ring-2 ring-red-500/30' : border.strong,
            radius.md,
            transition.fast,
            displayValue ? textTokens.primary : textTokens.tertiary,
            'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
          )}
        >
          <CalendarDays className="h-4 w-4 text-zinc-400" />
          {displayValue || placeholder}
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
            <p className={cn('text-xs mb-2', textTokens.tertiary)}>
              Select {selecting === 'start' ? 'start' : 'end'} date
            </p>
            <Calendar
              selected={selecting === 'start' ? value?.start : value?.end}
              onDateSelect={handleSelect}
            />
          </div>
        )}
      </div>
    );
  },
);
DateRangePicker.displayName = 'DateRangePicker';
