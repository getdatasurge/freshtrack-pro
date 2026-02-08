import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { spacing } from '@/lib/design-system/tokens';

export interface CardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4;
  gap?: 'tight' | 'default' | 'loose';
}

const colClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
} as const;

const gapClasses = {
  tight: 'gap-3',
  default: spacing.grid,
  loose: spacing.gridLoose,
} as const;

export const CardGrid = React.forwardRef<HTMLDivElement, CardGridProps>(
  ({ className, cols = 3, gap = 'default', children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('grid', colClasses[cols], gapClasses[gap], className)} {...props}>
        {children}
      </div>
    );
  },
);
CardGrid.displayName = 'CardGrid';
