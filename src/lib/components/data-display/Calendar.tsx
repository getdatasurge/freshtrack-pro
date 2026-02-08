import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, transition } from '@/lib/design-system/tokens';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CalendarProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: Date;
  onDateSelect?: (date: Date) => void;
  month?: Date;
  onMonthChange?: (date: Date) => void;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  ({ className, selected, onDateSelect, month: controlledMonth, onMonthChange, ...props }, ref) => {
    const [internalMonth, setInternalMonth] = React.useState(() => controlledMonth || selected || new Date());
    const current = controlledMonth || internalMonth;
    const year = current.getFullYear();
    const monthIdx = current.getMonth();

    const daysInMonth = getDaysInMonth(year, monthIdx);
    const firstDay = getFirstDayOfWeek(year, monthIdx);
    const today = new Date();

    const navigate = (delta: number) => {
      const next = new Date(year, monthIdx + delta, 1);
      if (onMonthChange) onMonthChange(next);
      else setInternalMonth(next);
    };

    return (
      <div ref={ref} className={cn('w-64', className)} {...props}>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => navigate(-1)} className={cn('p-1 rounded hover:bg-zinc-800', transition.fast)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4 text-zinc-400" />
          </button>
          <span className={cn('text-sm font-medium', textTokens.primary)}>
            {current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button type="button" onClick={() => navigate(1)} className={cn('p-1 rounded hover:bg-zinc-800', transition.fast)} aria-label="Next month">
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0">
          {DAYS.map((d) => (
            <div key={d} className={cn('text-center text-xs font-medium py-1', textTokens.tertiary)}>
              {d}
            </div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(year, monthIdx, i + 1);
            const isSelected = selected && isSameDay(date, selected);
            const isToday = isSameDay(date, today);

            return (
              <button
                key={i}
                type="button"
                onClick={() => onDateSelect?.(date)}
                className={cn(
                  'h-8 w-8 mx-auto rounded-full flex items-center justify-center text-sm',
                  transition.fast,
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : isToday
                      ? 'bg-zinc-800 text-zinc-50'
                      : `${textTokens.secondary} hover:bg-zinc-800/50`,
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);
Calendar.displayName = 'Calendar';
