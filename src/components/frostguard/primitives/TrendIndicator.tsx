import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { status } from '@/lib/design-system/tokens';
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

    let colorClass: string = status.neutral.text;
    if (isGood) colorClass = status.success.text;
    if (isBad) colorClass = status.danger.text;

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
