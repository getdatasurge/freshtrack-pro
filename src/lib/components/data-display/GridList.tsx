import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { spacing } from '@/lib/design-system/tokens';

export interface GridListProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4;
}

const colClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
} as const;

export const GridList = React.forwardRef<HTMLDivElement, GridListProps>(
  ({ className, cols = 3, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('grid', colClasses[cols], spacing.grid, className)} {...props}>
        {children}
      </div>
    );
  },
);
GridList.displayName = 'GridList';
