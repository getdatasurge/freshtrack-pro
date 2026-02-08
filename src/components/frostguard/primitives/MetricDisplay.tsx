import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { typography, text as textTokens } from '@/lib/design-system/tokens';

export interface MetricDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number | string;
  unit?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const sizeConfig = {
  sm: { value: typography.metricSm, unit: 'text-base' },
  md: { value: typography.metric, unit: 'text-lg' },
  lg: { value: 'text-4xl font-semibold tabular-nums text-zinc-50', unit: 'text-xl' },
} as const;

export const MetricDisplay = React.forwardRef<HTMLDivElement, MetricDisplayProps>(
  ({ className, value, unit, label, size = 'md', color, ...props }, ref) => {
    const config = sizeConfig[size];

    return (
      <div ref={ref} className={cn('inline-flex flex-col', className)} {...props}>
        {label && <span className={cn('text-sm mb-0.5', textTokens.tertiary)}>{label}</span>}
        <span className={cn(config.value, color)}>
          {value}
          {unit && <span className={cn(config.unit, 'ml-0.5 font-normal', textTokens.tertiary)}>{unit}</span>}
        </span>
      </div>
    );
  },
);
MetricDisplay.displayName = 'MetricDisplay';
