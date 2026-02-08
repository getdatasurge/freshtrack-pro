import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface TrendIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  unit?: string;
  invertColors?: boolean;
}

export const TrendIndicator = React.forwardRef<HTMLDivElement, TrendIndicatorProps>(
  ({ className, value, unit = '', invertColors = false, ...props }, ref) => {
    const isUp = value > 0;
    const isDown = value < 0;
    const isFlat = value === 0;

    const isGood = invertColors ? isDown : isUp;
    const isBad = invertColors ? isUp : isDown;

    let colorClass = 'text-zinc-500';
    if (isGood) colorClass = 'text-emerald-400';
    if (isBad) colorClass = 'text-red-400';

    return (
      <div ref={ref} className={cn('inline-flex items-center gap-1 text-sm', colorClass, className)} {...props}>
        {isUp && <TrendingUp className="h-4 w-4" />}
        {isDown && <TrendingDown className="h-4 w-4" />}
        {isFlat && <Minus className="h-4 w-4" />}
        <span className="font-medium tabular-nums">
          {isUp ? '+' : ''}{value}{unit}
        </span>
      </div>
    );
  },
);
TrendIndicator.displayName = 'TrendIndicator';
