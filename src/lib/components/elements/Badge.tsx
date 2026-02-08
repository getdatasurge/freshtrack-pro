import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { status, type StatusVariant, transition } from '@/lib/design-system/tokens';

export type BadgeSize = 'sm' | 'md';

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulsing?: boolean;
  removable?: boolean;
  onRemove?: () => void;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', size = 'sm', dot, pulsing, removable, onRemove, children, ...props }, ref) => {
    const colors = status[variant];

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 font-medium border',
          'rounded-full',
          transition.fast,
          sizeClasses[size],
          colors.bg,
          colors.text,
          colors.border,
          className,
        )}
        {...props}
      >
        {dot && (
          <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot, pulsing && 'animate-pulse')}>
            {pulsing && (
              <span className={cn('absolute inset-0 h-1.5 w-1.5 rounded-full opacity-75', colors.dot, 'animate-ping')} />
            )}
          </span>
        )}
        {children}
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-0.5 -mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-white/20"
            aria-label="Remove"
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        )}
      </span>
    );
  },
);
Badge.displayName = 'Badge';
