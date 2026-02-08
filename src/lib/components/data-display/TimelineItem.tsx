import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, status, type StatusVariant } from '@/lib/design-system/tokens';

export interface TimelineItemProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  timestamp?: string;
  variant?: StatusVariant;
  isLast?: boolean;
}

export const TimelineItem = React.forwardRef<HTMLDivElement, TimelineItemProps>(
  ({ className, icon, title, description, timestamp, variant = 'neutral', isLast, ...props }, ref) => {
    const colors = status[variant];

    return (
      <div ref={ref} className={cn('relative flex gap-3 pb-6', isLast && 'pb-0', className)} {...props}>
        {/* Connector line */}
        {!isLast && (
          <div className="absolute left-[11px] top-6 bottom-0 w-px bg-zinc-800" />
        )}
        {/* Dot/Icon */}
        <div className="relative flex-shrink-0">
          {icon ? (
            <div className={cn('h-6 w-6 rounded-full flex items-center justify-center', colors.bg, '[&_svg]:h-3.5 [&_svg]:w-3.5', colors.icon)}>
              {icon}
            </div>
          ) : (
            <div className={cn('h-6 w-6 flex items-center justify-center')}>
              <div className={cn('h-2.5 w-2.5 rounded-full', colors.dot)} />
            </div>
          )}
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-sm font-medium', textTokens.primary)}>{title}</p>
            {timestamp && <span className={cn('text-xs flex-shrink-0', textTokens.tertiary)}>{timestamp}</span>}
          </div>
          {description && <p className={cn('mt-0.5 text-sm', textTokens.tertiary)}>{description}</p>}
        </div>
      </div>
    );
  },
);
TimelineItem.displayName = 'TimelineItem';
