/**
 * Temperature Limits Widget
 *
 * Displays configured high and low temperature limits.
 * Note: Card wrapper is provided by WidgetWrapper.
 */

import { useUnitsSafe } from "@/contexts/UnitsContext";

interface TempLimitsWidgetProps {
  tempLimitHigh: number;
  tempLimitLow: number | null;
}

export function TempLimitsWidget({
  tempLimitHigh,
  tempLimitLow,
}: TempLimitsWidgetProps) {
  const { formatTemp } = useUnitsSafe();

  return (
    <div className="h-full p-4">
      <p className="text-sm font-medium text-muted-foreground mb-3">Configured Limits</p>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">High Limit</span>
          <span className="font-medium text-alarm">{formatTemp(tempLimitHigh)}</span>
        </div>
        {tempLimitLow !== null && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Low Limit</span>
            <span className="font-medium text-accent">{formatTemp(tempLimitLow)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
