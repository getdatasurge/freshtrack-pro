import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, transition } from '@/lib/design-system/tokens';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps extends React.HTMLAttributes<HTMLElement> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
}

function getPageRange(current: number, total: number, siblings: number): (number | 'ellipsis')[] {
  const totalSlots = siblings * 2 + 5; // siblings + boundary + ellipsis + current
  if (total <= totalSlots) return Array.from({ length: total }, (_, i) => i + 1);

  const leftBound = Math.max(current - siblings, 2);
  const rightBound = Math.min(current + siblings, total - 1);
  const showLeftEllipsis = leftBound > 2;
  const showRightEllipsis = rightBound < total - 1;

  const pages: (number | 'ellipsis')[] = [1];
  if (showLeftEllipsis) pages.push('ellipsis');
  for (let i = leftBound; i <= rightBound; i++) pages.push(i);
  if (showRightEllipsis) pages.push('ellipsis');
  pages.push(total);

  return pages;
}

export const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  ({ className, currentPage, totalPages, onPageChange, siblingCount = 1, ...props }, ref) => {
    const pages = getPageRange(currentPage, totalPages, siblingCount);

    const buttonBase = cn(
      'inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md text-sm',
      transition.fast,
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
    );

    return (
      <nav ref={ref} aria-label="Pagination" className={cn('flex items-center gap-1', className)} {...props}>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={cn(buttonBase, textTokens.secondary, 'hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none')}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((page, idx) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className={cn('px-1', textTokens.tertiary)}>...</span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              aria-current={page === currentPage ? 'page' : undefined}
              className={cn(
                buttonBase,
                page === currentPage
                  ? 'bg-zinc-800 text-zinc-50 font-medium'
                  : `${textTokens.secondary} hover:bg-zinc-800/50`,
              )}
            >
              {page}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={cn(buttonBase, textTokens.secondary, 'hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none')}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    );
  },
);
Pagination.displayName = 'Pagination';
