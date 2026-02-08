import * as React from 'react';
import { cn } from '@/lib/design-system/cn';

export interface FeedProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Feed = React.forwardRef<HTMLDivElement, FeedProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('divide-y divide-zinc-800/50', className)} {...props}>
        {children}
      </div>
    );
  },
);
Feed.displayName = 'Feed';
