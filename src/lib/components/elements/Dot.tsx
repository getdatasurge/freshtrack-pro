import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { status, type StatusVariant } from '@/lib/design-system/tokens';

export interface DotProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusVariant;
  pulsing?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
} as const;

export const Dot = React.forwardRef<HTMLSpanElement, DotProps>(
  ({ className, variant = 'neutral', pulsing = false, size = 'md', ...props }, ref) => {
    const colors = status[variant];

    return (
      <span ref={ref} className={cn('relative inline-flex', className)} {...props}>
        {pulsing && (
          <span
            className={cn('absolute inline-flex rounded-full opacity-75 animate-ping', sizeClasses[size], colors.dot)}
          />
        )}
        <span className={cn('relative inline-flex rounded-full', sizeClasses[size], colors.dot)} />
      </span>
    );
  },
);
Dot.displayName = 'Dot';
