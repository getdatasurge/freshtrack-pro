import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, radius, text as textTokens } from '@/lib/design-system/tokens';
import { Skeleton } from '../feedback/Skeleton';

export interface DataTableColumn<T> {
  id: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T> extends React.HTMLAttributes<HTMLDivElement> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  loading?: boolean;
  loadingRows?: number;
  compact?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

function DataTableInner<T>(
  { className, columns, data, keyExtractor, loading, loadingRows = 5, compact, emptyState, onRowClick, ...props }: DataTableProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <div ref={ref} className={cn('border', border.default, radius.lg, 'overflow-hidden', className)} {...props}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-900">
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={cn(
                    cellPadding,
                    'text-left text-xs font-medium uppercase tracking-wider',
                    textTokens.tertiary,
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cn('divide-y', border.subtle)}>
            {loading
              ? Array.from({ length: loadingRows }).map((_, i) => (
                  <tr key={`loading-${i}`}>
                    {columns.map((col) => (
                      <td key={col.id} className={cellPadding}>
                        <Skeleton width="80%" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.length === 0
                ? (
                    <tr>
                      <td colSpan={columns.length}>{emptyState}</td>
                    </tr>
                  )
                : data.map((row) => (
                    <tr
                      key={keyExtractor(row)}
                      className={cn(
                        'hover:bg-zinc-800/50 transition-colors',
                        onRowClick && 'cursor-pointer',
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {columns.map((col) => (
                        <td key={col.id} className={cn(cellPadding, 'text-sm', textTokens.secondary)}>
                          {col.accessor(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const DataTable = React.forwardRef(DataTableInner) as <T>(
  props: DataTableProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> },
) => React.ReactElement;
