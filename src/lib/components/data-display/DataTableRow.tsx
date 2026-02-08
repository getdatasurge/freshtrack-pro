import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { border, transition } from '@/lib/design-system/tokens';

export interface DataTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  compact?: boolean;
}

export const DataTableRow = React.forwardRef<HTMLTableRowElement, DataTableRowProps>(
  ({ className, selected, compact, children, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={cn(
          `border-b ${border.subtle}`,
          transition.fast,
          'hover:bg-zinc-800/50',
          selected && 'bg-blue-500/10 border-l-2 border-l-blue-500',
          className,
        )}
        aria-selected={selected}
        {...props}
      >
        {children}
      </tr>
    );
  },
);
DataTableRow.displayName = 'DataTableRow';
