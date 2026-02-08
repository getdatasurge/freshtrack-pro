import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, transition } from '@/lib/design-system/tokens';

export interface SidebarLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  sidebar: React.ReactNode;
  sidebarCollapsed?: boolean;
  sidebarWidth?: number;
  collapsedWidth?: number;
}

export const SidebarLayout = React.forwardRef<HTMLDivElement, SidebarLayoutProps>(
  ({ className, sidebar, sidebarCollapsed = false, sidebarWidth = 256, collapsedWidth = 64, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex h-screen overflow-hidden', surface.base, className)} {...props}>
        <div
          className={cn('flex-shrink-0 h-full overflow-hidden', transition.default)}
          style={{ width: sidebarCollapsed ? collapsedWidth : sidebarWidth }}
        >
          {sidebar}
        </div>
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    );
  },
);
SidebarLayout.displayName = 'SidebarLayout';
