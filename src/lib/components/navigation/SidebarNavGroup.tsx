import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { typography, transition } from '@/lib/design-system/tokens';
import { ChevronDown } from 'lucide-react';

export interface SidebarNavGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  defaultOpen?: boolean;
  collapsible?: boolean;
}

export const SidebarNavGroup = React.forwardRef<HTMLDivElement, SidebarNavGroupProps>(
  ({ className, label, defaultOpen = true, collapsible = true, children, ...props }, ref) => {
    const [open, setOpen] = React.useState(defaultOpen);

    return (
      <div ref={ref} className={cn('space-y-1', className)} {...props}>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'flex items-center justify-between w-full px-3 py-2',
              typography.overline,
              transition.fast,
            )}
            aria-expanded={open}
          >
            <span>{label}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 text-zinc-500', transition.fast, !open && '-rotate-90')} />
          </button>
        ) : (
          <div className={cn('px-3 py-2', typography.overline)}>{label}</div>
        )}
        {open && <div className="space-y-0.5">{children}</div>}
      </div>
    );
  },
);
SidebarNavGroup.displayName = 'SidebarNavGroup';
