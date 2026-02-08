import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, transition } from '@/lib/design-system/tokens';

export interface MultiColumnLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  sidebar: React.ReactNode;
  panel?: React.ReactNode;
  sidebarCollapsed?: boolean;
  sidebarWidth?: number;
  panelWidth?: number;
  panelOpen?: boolean;
}

export const MultiColumnLayout = React.forwardRef<HTMLDivElement, MultiColumnLayoutProps>(
  ({ className, sidebar, panel, sidebarCollapsed = false, sidebarWidth = 256, panelWidth = 320, panelOpen = false, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex h-screen overflow-hidden', surface.base, className)} {...props}>
        <div
          className={cn('flex-shrink-0 h-full overflow-hidden', transition.default)}
          style={{ width: sidebarCollapsed ? 64 : sidebarWidth }}
        >
          {sidebar}
        </div>
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
        {panel && panelOpen && (
          <div
            className={cn(
              'flex-shrink-0 h-full overflow-y-auto',
              `border-l ${border.default}`,
              surface.raised,
              transition.default,
            )}
            style={{ width: panelWidth }}
          >
            {panel}
          </div>
        )}
      </div>
    );
  },
);
MultiColumnLayout.displayName = 'MultiColumnLayout';
