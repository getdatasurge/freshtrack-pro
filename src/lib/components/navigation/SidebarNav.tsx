import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, transition } from '@/lib/design-system/tokens';

export interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const SidebarNav = React.forwardRef<HTMLElement, SidebarNavProps>(
  ({ className, collapsed, header, footer, children, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        className={cn(
          'flex flex-col h-full',
          surface.raised,
          `border-r ${border.default}`,
          transition.default,
          collapsed ? 'w-16' : 'w-64',
          className,
        )}
        aria-label="Sidebar navigation"
        {...props}
      >
        {header && <div className={cn('p-4', `border-b ${border.default}`)}>{header}</div>}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">{children}</div>
        {footer && <div className={cn('p-4', `border-t ${border.default}`)}>{footer}</div>}
      </nav>
    );
  },
);
SidebarNav.displayName = 'SidebarNav';
