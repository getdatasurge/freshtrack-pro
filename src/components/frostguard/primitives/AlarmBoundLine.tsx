import * as React from 'react';
import { cn } from '@/lib/design-system/cn';

export interface AlarmBoundLineProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The alarm value to display */
  value: number;
  /** Label for the bound (e.g. "Warning High") */
  label?: string;
  /** Severity of the bound */
  severity: 'warning' | 'critical';
  /** Unit to append (e.g. "°F") */
  unit?: string;
  /** Position as percentage (0-100) for overlay on sparklines */
  position?: number;
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Alarm threshold reference line for sparkline overlays.
 * Renders a dashed line at the threshold position with a small label.
 * Designed to be absolutely positioned over a chart area.
 */
export const AlarmBoundLine = React.forwardRef<HTMLDivElement, AlarmBoundLineProps>(
  ({ className, value, label, severity, unit = '', position, orientation = 'horizontal', ...props }, ref) => {
    const color = severity === 'critical' ? 'border-red-500/50' : 'border-amber-500/50';
    const textColor = severity === 'critical' ? 'text-red-500/70' : 'text-amber-500/70';

    if (orientation === 'horizontal' && position != null) {
      return (
        <div
          ref={ref}
          className={cn(
            'absolute left-0 right-0 border-t border-dashed pointer-events-none',
            color,
            className,
          )}
          style={{ bottom: `${position}%` }}
          {...props}
        >
          <span className={cn('absolute right-1 -top-3 text-[10px] font-medium tabular-nums', textColor)}>
            {label || `${value}${unit}`}
          </span>
        </div>
      );
    }

    // Inline (non-positioned) variant for use outside charts
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-2 text-xs',
          textColor,
          className,
        )}
        {...props}
      >
        <div className={cn('flex-1 border-t border-dashed', color)} />
        <span className="font-medium tabular-nums whitespace-nowrap">
          {label ? `${label}: ` : ''}{value}{unit}
        </span>
      </div>
    );
  },
);
AlarmBoundLine.displayName = 'AlarmBoundLine';
