import * as React from 'react';
import { cn } from '@/lib/design-system/cn';

export interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('relative', className)} {...props}>
        {children}
      </div>
    );
  },
);
Timeline.displayName = 'Timeline';
