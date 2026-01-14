/**
 * Temperature Statistics Widget
 * 
 * Shows min, max, and average temperature for the selected period.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Minus, BarChart3 } from "lucide-react";
import type { WidgetProps } from "../types";

export function TemperatureStatisticsWidget({ readings = [] }: WidgetProps) {
  const stats = useMemo(() => {
    if (!readings || readings.length === 0) {
      return { min: null, max: null, avg: null, count: 0 };
    }

    const temps = readings.map(r => r.temperature).filter(t => t !== null) as number[];
    if (temps.length === 0) {
      return { min: null, max: null, avg: null, count: 0 };
    }

    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;

    return { min, max, avg, count: temps.length };
  }, [readings]);

  if (stats.count === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Temperature Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-4">
          No readings in selected period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Temperature Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-blue-500">
              <ArrowDown className="h-4 w-4" />
              <span className="text-xs font-medium">MIN</span>
            </div>
            <p className="text-2xl font-bold">{stats.min?.toFixed(1)}°</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Minus className="h-4 w-4" />
              <span className="text-xs font-medium">AVG</span>
            </div>
            <p className="text-2xl font-bold">{stats.avg?.toFixed(1)}°</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-red-500">
              <ArrowUp className="h-4 w-4" />
              <span className="text-xs font-medium">MAX</span>
            </div>
            <p className="text-2xl font-bold">{stats.max?.toFixed(1)}°</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Based on {stats.count} readings
        </p>
      </CardContent>
    </Card>
  );
}
