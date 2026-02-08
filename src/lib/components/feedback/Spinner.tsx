import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  label?: string;
}

export const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = 'md', label, ...props }, ref) => {
    return (
      <div ref={ref} role="status" className={cn('inline-flex items-center gap-2', className)} {...props}>
        <svg
          className={cn('animate-spin', textTokens.tertiary, sizeClasses[size])}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        {label && <span className={cn('text-sm', textTokens.secondary)}>{label}</span>}
        <span className="sr-only">{label || 'Loading...'}</span>
      </div>
    );
  },
);
Spinner.displayName = 'Spinner';
