import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, radius } from '@/lib/design-system/tokens';

export interface StackedListProps extends React.HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
}

export const StackedList = React.forwardRef<HTMLDivElement, StackedListProps>(
  ({ className, bordered = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          radius.lg,
          'overflow-hidden',
          bordered && `border ${border.default} ${surface.raised}`,
          className,
        )}
        role="list"
        {...props}
      >
        {children}
      </div>
    );
  },
);
StackedList.displayName = 'StackedList';
