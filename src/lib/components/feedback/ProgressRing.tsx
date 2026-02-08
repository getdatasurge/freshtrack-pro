import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { status, type StatusVariant, text as textTokens } from '@/lib/design-system/tokens';

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: StatusVariant;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export const ProgressRing = React.forwardRef<HTMLDivElement, ProgressRingProps>(
  ({ className, value, max = 100, variant = 'info', size = 48, strokeWidth = 4, showLabel = true, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const r = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (percentage / 100) * circumference;

    // Map variant to actual stroke color
    const strokeColorMap: Record<StatusVariant, string> = {
      info: '#3b82f6',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      neutral: '#71717a',
    };

    return (
      <div ref={ref} className={cn('relative inline-flex items-center justify-center', className)} {...props}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-zinc-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={strokeColorMap[variant]}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-in-out"
          />
        </svg>
        {showLabel && (
          <span className={cn('absolute text-xs font-medium tabular-nums', textTokens.primary)}>
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    );
  },
);
ProgressRing.displayName = 'ProgressRing';
