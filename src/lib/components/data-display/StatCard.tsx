import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, radius, spacing, typography, text as textTokens } from '@/lib/design-system/tokens';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  trend?: { value: number; label?: string; invertColors?: boolean };
  icon?: React.ReactNode;
  loading?: boolean;
}

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, label, value, trend, icon, loading, ...props }, ref) => {
    const trendIsPositive = trend && trend.value > 0;
    const trendIsNegative = trend && trend.value < 0;

    let trendColor = textTokens.tertiary;
    if (trend) {
      const isGood = trend.invertColors ? trendIsNegative : trendIsPositive;
      const isBad = trend.invertColors ? trendIsPositive : trendIsNegative;
      if (isGood) trendColor = 'text-emerald-400';
      if (isBad) trendColor = 'text-red-400';
    }

    return (
      <div
        ref={ref}
        className={cn(surface.raised, 'border', border.default, radius.lg, spacing.card, className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className={cn('text-sm', textTokens.tertiary)}>{label}</p>
            {loading ? (
              <div className="h-9 w-24 mt-1 animate-pulse bg-zinc-800 rounded" />
            ) : (
              <p className={cn('mt-1', typography.metric)}>{value}</p>
            )}
          </div>
          {icon && <div className={cn('flex-shrink-0', textTokens.tertiary, '[&_svg]:h-5 [&_svg]:w-5')}>{icon}</div>}
        </div>
        {trend && !loading && (
          <div className={cn('mt-2 flex items-center gap-1 text-sm', trendColor)}>
            {trendIsPositive ? <TrendingUp className="h-4 w-4" /> : trendIsNegative ? <TrendingDown className="h-4 w-4" /> : null}
            <span className="font-medium">{trend.value > 0 ? '+' : ''}{trend.value}%</span>
            {trend.label && <span className={textTokens.tertiary}>{trend.label}</span>}
          </div>
        )}
      </div>
    );
  },
);
StatCard.displayName = 'StatCard';
