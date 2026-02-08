import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { spacing } from '@/lib/design-system/tokens';
import { SearchInput } from '../forms/SearchInput';

export interface DataTableToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  bulkActions?: React.ReactNode;
  selectedCount?: number;
}

export const DataTableToolbar = React.forwardRef<HTMLDivElement, DataTableToolbarProps>(
  ({ className, searchValue, onSearchChange, searchPlaceholder = 'Search...', filters, actions, bulkActions, selectedCount = 0, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex items-center justify-between gap-4 px-4 py-3', className)} {...props}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {onSearchChange && (
            <div className="w-64">
              <SearchInput
                value={searchValue}
                onChange={(e) => onSearchChange(e.currentTarget.value)}
                onClear={() => onSearchChange('')}
                placeholder={searchPlaceholder}
              />
            </div>
          )}
          {filters}
          {selectedCount > 0 && bulkActions && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">{selectedCount} selected</span>
              {bulkActions}
            </div>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    );
  },
);
DataTableToolbar.displayName = 'DataTableToolbar';
