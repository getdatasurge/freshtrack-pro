/**
 * Temperature Limits Widget
 * 
 * Displays configured high and low temperature limits.
 * Note: Card wrapper is provided by WidgetWrapper.
 */

interface TempLimitsWidgetProps {
  tempLimitHigh: number;
  tempLimitLow: number | null;
}

export function TempLimitsWidget({
  tempLimitHigh,
  tempLimitLow,
}: TempLimitsWidgetProps) {
  return (
    <div className="h-full p-4">
      <p className="text-sm font-medium text-muted-foreground mb-3">Configured Limits</p>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">High Limit</span>
          <span className="font-medium text-alarm">{tempLimitHigh}°F</span>
        </div>
        {tempLimitLow !== null && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Low Limit</span>
            <span className="font-medium text-accent">{tempLimitLow}°F</span>
          </div>
        )}
      </div>
    </div>
  );
}
