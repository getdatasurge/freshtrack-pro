import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, zIndex } from '@/lib/design-system/tokens';

export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  logo?: React.ReactNode;
  actions?: React.ReactNode;
}

export const Navbar = React.forwardRef<HTMLElement, NavbarProps>(
  ({ className, logo, actions, children, ...props }, ref) => {
    return (
      <header
        ref={ref}
        className={cn(
          'sticky top-0 flex items-center justify-between h-14 px-4',
          surface.raised,
          `border-b ${border.default}`,
          zIndex.sticky,
          'backdrop-blur-sm bg-zinc-900/80',
          className,
        )}
        {...props}
      >
        {logo && <div className="flex-shrink-0">{logo}</div>}
        {children && <div className="flex-1 flex items-center mx-4">{children}</div>}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
    );
  },
);
Navbar.displayName = 'Navbar';
