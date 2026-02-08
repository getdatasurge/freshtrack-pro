import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { status, type StatusVariant, transition, text as textTokens } from '@/lib/design-system/tokens';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: StatusVariant;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
}

const heightClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
} as const;

export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, max = 100, variant = 'info', size = 'md', showLabel, label, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const colors = status[variant];

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {(showLabel || label) && (
          <div className="flex justify-between mb-1.5">
            {label && <span className={cn('text-xs font-medium', textTokens.secondary)}>{label}</span>}
            {showLabel && <span className={cn('text-xs', textTokens.tertiary)}>{Math.round(percentage)}%</span>}
          </div>
        )}
        <div
          className={cn('w-full rounded-full overflow-hidden bg-zinc-800', heightClasses[size])}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <div
            className={cn('h-full rounded-full', colors.dot, transition.slow)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  },
);
ProgressBar.displayName = 'ProgressBar';
