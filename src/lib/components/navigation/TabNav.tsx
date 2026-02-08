import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { border, text as textTokens, transition } from '@/lib/design-system/tokens';

export type TabNavVariant = 'underline' | 'pills' | 'enclosed';

export interface TabNavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface TabNavProps extends React.HTMLAttributes<HTMLDivElement> {
  items: TabNavItem[];
  activeId: string;
  onTabChange: (id: string) => void;
  variant?: TabNavVariant;
}

export const TabNav = React.forwardRef<HTMLDivElement, TabNavProps>(
  ({ className, items, activeId, onTabChange, variant = 'underline', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="tablist"
        className={cn(
          'flex',
          variant === 'underline' && `border-b ${border.default}`,
          variant === 'pills' && 'gap-1',
          variant === 'enclosed' && `border-b ${border.default}`,
          className,
        )}
        {...props}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;

          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              disabled={item.disabled}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'inline-flex items-center gap-2 text-sm font-medium whitespace-nowrap',
                transition.fast,
                'disabled:opacity-50 disabled:pointer-events-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
                variant === 'underline' && [
                  'px-4 py-2.5 -mb-px border-b-2',
                  isActive
                    ? 'border-blue-500 text-zinc-50'
                    : `border-transparent ${textTokens.tertiary} hover:text-zinc-300 hover:border-zinc-600`,
                ],
                variant === 'pills' && [
                  'px-3 py-1.5 rounded-lg',
                  isActive
                    ? 'bg-zinc-800 text-zinc-50'
                    : `${textTokens.tertiary} hover:text-zinc-300 hover:bg-zinc-800/50`,
                ],
                variant === 'enclosed' && [
                  'px-4 py-2.5 -mb-px border border-b-0 rounded-t-lg',
                  isActive
                    ? `bg-zinc-900 text-zinc-50 ${border.default} border-b-zinc-900`
                    : `bg-transparent border-transparent ${textTokens.tertiary} hover:text-zinc-300`,
                ],
              )}
            >
              {item.icon && <span className="[&_svg]:h-4 [&_svg]:w-4">{item.icon}</span>}
              {item.label}
              {item.badge}
            </button>
          );
        })}
      </div>
    );
  },
);
TabNav.displayName = 'TabNav';
