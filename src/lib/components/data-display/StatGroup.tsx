import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { spacing } from '@/lib/design-system/tokens';

export interface StatGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 2 | 3 | 4;
}

const colClasses = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
} as const;

export const StatGroup = React.forwardRef<HTMLDivElement, StatGroupProps>(
  ({ className, cols = 4, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('grid', colClasses[cols], spacing.grid, className)} {...props}>
        {children}
      </div>
    );
  },
);
StatGroup.displayName = 'StatGroup';
