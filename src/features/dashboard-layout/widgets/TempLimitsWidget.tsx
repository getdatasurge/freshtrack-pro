/**
 * Temperature Limits Widget
 * 
 * Displays configured high and low temperature limits.
 */

import { Card, CardContent } from "@/components/ui/card";

interface TempLimitsWidgetProps {
  tempLimitHigh: number;
  tempLimitLow: number | null;
}

export function TempLimitsWidget({
  tempLimitHigh,
  tempLimitLow,
}: TempLimitsWidgetProps) {
  return (
    <Card className="h-full">
      <CardContent className="pt-4 h-full">
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
      </CardContent>
    </Card>
  );
}
