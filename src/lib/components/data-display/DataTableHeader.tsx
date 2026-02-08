import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, transition } from '@/lib/design-system/tokens';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;

export interface DataTableHeaderProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: SortDirection;
  onSort?: () => void;
}

export const DataTableHeader = React.forwardRef<HTMLTableCellElement, DataTableHeaderProps>(
  ({ className, sortable, sortDirection, onSort, children, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={cn(
          'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider',
          textTokens.tertiary,
          'bg-zinc-900 sticky top-0',
          sortable && `cursor-pointer select-none ${transition.fast} hover:text-zinc-300`,
          className,
        )}
        onClick={sortable ? onSort : undefined}
        aria-sort={sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : undefined}
        {...props}
      >
        <div className="flex items-center gap-1">
          <span>{children}</span>
          {sortable && (
            <span className="inline-flex">
              {sortDirection === 'asc' ? (
                <ChevronUp className="h-3.5 w-3.5 text-zinc-200" />
              ) : sortDirection === 'desc' ? (
                <ChevronDown className="h-3.5 w-3.5 text-zinc-200" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-600" />
              )}
            </span>
          )}
        </div>
      </th>
    );
  },
);
DataTableHeader.displayName = 'DataTableHeader';
