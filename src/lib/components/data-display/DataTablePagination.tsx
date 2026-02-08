import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { border, text as textTokens } from '@/lib/design-system/tokens';
import { Pagination } from '../navigation/Pagination';

export interface DataTablePaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const DataTablePagination = React.forwardRef<HTMLDivElement, DataTablePaginationProps>(
  ({ className, currentPage, totalPages, totalItems, pageSize, onPageChange, ...props }, ref) => {
    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalItems);

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between px-4 py-3',
          `border-t ${border.default}`,
          className,
        )}
        {...props}
      >
        <p className={cn('text-sm', textTokens.tertiary)}>
          Showing <span className={textTokens.secondary}>{from}</span> to{' '}
          <span className={textTokens.secondary}>{to}</span> of{' '}
          <span className={textTokens.secondary}>{totalItems}</span> results
        </p>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    );
  },
);
DataTablePagination.displayName = 'DataTablePagination';
