import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { border } from '@/lib/design-system/tokens';

export interface SplitViewProps extends React.HTMLAttributes<HTMLDivElement> {
  sidebar: React.ReactNode;
  sidebarWidth?: string;
  sidebarPosition?: 'left' | 'right';
}

export const SplitView = React.forwardRef<HTMLDivElement, SplitViewProps>(
  ({ className, sidebar, sidebarWidth = '320px', sidebarPosition = 'left', children, ...props }, ref) => {
    const sidebarEl = (
      <div
        className={cn(
          'flex-shrink-0 overflow-y-auto',
          sidebarPosition === 'left' ? `border-r ${border.default}` : `border-l ${border.default}`,
        )}
        style={{ width: sidebarWidth }}
      >
        {sidebar}
      </div>
    );

    return (
      <div ref={ref} className={cn('flex h-full', className)} {...props}>
        {sidebarPosition === 'left' && sidebarEl}
        <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
        {sidebarPosition === 'right' && sidebarEl}
      </div>
    );
  },
);
SplitView.displayName = 'SplitView';
