import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';

function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export interface TimeAgoProps extends React.HTMLAttributes<HTMLSpanElement> {
  date: string | Date;
  refreshInterval?: number;
}

export const TimeAgo = React.forwardRef<HTMLSpanElement, TimeAgoProps>(
  ({ className, date, refreshInterval = 30000, ...props }, ref) => {
    const [, forceUpdate] = React.useReducer((c: number) => c + 1, 0);
    const parsed = typeof date === 'string' ? new Date(date) : date;

    React.useEffect(() => {
      const interval = setInterval(forceUpdate, refreshInterval);
      return () => clearInterval(interval);
    }, [refreshInterval]);

    return (
      <span
        ref={ref}
        className={cn('text-xs tabular-nums', textTokens.tertiary, className)}
        title={parsed.toLocaleString()}
        {...props}
      >
        {formatTimeAgo(parsed)}
      </span>
    );
  },
);
TimeAgo.displayName = 'TimeAgo';
