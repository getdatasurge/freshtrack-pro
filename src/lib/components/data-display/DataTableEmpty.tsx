import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { EmptyState, type EmptyStateProps } from '../feedback/EmptyState';

export interface DataTableEmptyProps extends EmptyStateProps {
  colSpan?: number;
}

export const DataTableEmpty = React.forwardRef<HTMLDivElement, DataTableEmptyProps>(
  ({ colSpan, ...props }, ref) => {
    if (colSpan !== undefined) {
      return (
        <tr>
          <td colSpan={colSpan}>
            <EmptyState ref={ref} {...props} />
          </td>
        </tr>
      );
    }
    return <EmptyState ref={ref} {...props} />;
  },
);
DataTableEmpty.displayName = 'DataTableEmpty';
