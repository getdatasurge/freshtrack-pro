import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, zIndex } from '@/lib/design-system/tokens';

export interface StickyHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
}

export const StickyHeader = React.forwardRef<HTMLDivElement, StickyHeaderProps>(
  ({ className, bordered = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'sticky top-0',
          surface.raised,
          zIndex.sticky,
          'backdrop-blur-sm bg-zinc-900/80',
          bordered && `border-b ${border.default}`,
          'px-4 py-3',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
StickyHeader.displayName = 'StickyHeader';
