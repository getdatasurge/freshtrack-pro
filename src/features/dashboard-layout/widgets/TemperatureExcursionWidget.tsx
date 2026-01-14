/**
 * Temperature Excursion Widget
 * 
 * Shows count and duration of out-of-range events.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, ArrowUp, ArrowDown } from "lucide-react";
import type { WidgetProps } from "../types";

export function TemperatureExcursionWidget({ readings = [], unit }: WidgetProps) {
  const excursions = useMemo(() => {
    if (!readings || readings.length === 0 || !unit) {
      return { highCount: 0, lowCount: 0, totalMinutes: 0 };
    }

    const highLimit = unit.temp_limit_high ?? 40;
    const lowLimit = unit.temp_limit_low;

    let highCount = 0;
    let lowCount = 0;
    let totalMinutes = 0;
    let wasInExcursion = false;
    let excursionStart: Date | null = null;

    // Sort readings by time
    const sorted = [...readings].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );

    sorted.forEach((reading, index) => {
      const isHigh = reading.temperature > highLimit;
      const isLow = lowLimit !== null && reading.temperature < lowLimit;
      const isExcursion = isHigh || isLow;

      if (isExcursion && !wasInExcursion) {
        // Starting an excursion
        if (isHigh) highCount++;
        if (isLow) lowCount++;
        excursionStart = new Date(reading.recorded_at);
      } else if (!isExcursion && wasInExcursion && excursionStart) {
        // Ending an excursion
        const duration = (new Date(reading.recorded_at).getTime() - excursionStart.getTime()) / 60000;
        totalMinutes += duration;
        excursionStart = null;
      }

      wasInExcursion = isExcursion;

      // Handle ongoing excursion at end of data
      if (index === sorted.length - 1 && wasInExcursion && excursionStart) {
        const duration = (new Date(reading.recorded_at).getTime() - excursionStart.getTime()) / 60000;
        totalMinutes += duration;
      }
    });

    return { highCount, lowCount, totalMinutes };
  }, [readings, unit]);

  const totalCount = excursions.highCount + excursions.lowCount;
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          Temperature Excursions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalCount === 0 ? (
          <div className="text-center py-4">
            <p className="text-3xl font-bold text-green-500">0</p>
            <p className="text-sm text-muted-foreground mt-1">No excursions in period</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-4">
              <p className="text-3xl font-bold text-destructive">{totalCount}</p>
              <p className="text-sm text-muted-foreground">
                Total duration: {formatDuration(excursions.totalMinutes)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 p-2 rounded bg-red-500/10">
                <ArrowUp className="h-4 w-4 text-red-500" />
                <span className="text-muted-foreground">High:</span>
                <span className="font-medium">{excursions.highCount}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-blue-500/10">
                <ArrowDown className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground">Low:</span>
                <span className="font-medium">{excursions.lowCount}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
