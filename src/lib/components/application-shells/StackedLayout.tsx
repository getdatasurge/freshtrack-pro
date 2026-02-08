import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface } from '@/lib/design-system/tokens';

export interface StackedLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  header: React.ReactNode;
}

export const StackedLayout = React.forwardRef<HTMLDivElement, StackedLayoutProps>(
  ({ className, header, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex flex-col h-screen', surface.base, className)} {...props}>
        {header}
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    );
  },
);
StackedLayout.displayName = 'StackedLayout';
