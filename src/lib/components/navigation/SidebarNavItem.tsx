import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { transition, text as textTokens } from '@/lib/design-system/tokens';

export interface SidebarNavItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: React.ReactNode;
  nested?: boolean;
  collapsed?: boolean;
  href?: string;
  as?: React.ElementType;
}

export const SidebarNavItem = React.forwardRef<HTMLButtonElement, SidebarNavItemProps>(
  ({ className, icon, label, active, badge, nested, collapsed, href, as, ...props }, ref) => {
    const Comp: React.ElementType = as || (href ? 'a' : 'button');

    return (
      <Comp
        ref={ref}
        href={href}
        className={cn(
          'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-left',
          transition.fast,
          active
            ? 'bg-zinc-800 text-zinc-50 border-l-2 border-blue-500'
            : `${textTokens.secondary} hover:bg-zinc-800/50 hover:text-zinc-100`,
          nested && 'pl-10 text-sm',
          collapsed && 'justify-center px-2',
          className,
        )}
        aria-current={active ? 'page' : undefined}
        {...props}
      >
        {icon && (
          <span className={cn('[&_svg]:h-5 [&_svg]:w-5', active ? 'text-zinc-50' : 'text-zinc-400')}>
            {icon}
          </span>
        )}
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-sm font-medium">{label}</span>
            {badge && <span className="flex-shrink-0">{badge}</span>}
          </>
        )}
      </Comp>
    );
  },
);
SidebarNavItem.displayName = 'SidebarNavItem';
