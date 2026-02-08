import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, transition, border } from '@/lib/design-system/tokens';

export interface VerticalNavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface VerticalNavProps extends React.HTMLAttributes<HTMLDivElement> {
  items: VerticalNavItem[];
  activeId: string;
  onItemChange: (id: string) => void;
}

export const VerticalNav = React.forwardRef<HTMLDivElement, VerticalNavProps>(
  ({ className, items, activeId, onItemChange, ...props }, ref) => {
    return (
      <div ref={ref} role="tablist" aria-orientation="vertical" className={cn('space-y-1', className)} {...props}>
        {items.map((item) => {
          const isActive = item.id === activeId;

          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              disabled={item.disabled}
              onClick={() => onItemChange(item.id)}
              className={cn(
                'flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left',
                transition.fast,
                'disabled:opacity-50 disabled:pointer-events-none',
                isActive
                  ? `bg-zinc-800 text-zinc-50 border-l-2 border-blue-500`
                  : `${textTokens.secondary} hover:bg-zinc-800/50`,
              )}
            >
              {item.icon && <span className="[&_svg]:h-5 [&_svg]:w-5 flex-shrink-0">{item.icon}</span>}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{item.label}</div>
                {item.description && (
                  <div className={cn('text-xs mt-0.5', textTokens.tertiary)}>{item.description}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  },
);
VerticalNav.displayName = 'VerticalNav';
