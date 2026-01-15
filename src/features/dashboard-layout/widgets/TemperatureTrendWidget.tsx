/**
 * Temperature Trend Widget
 * 
 * Shows rising, falling, or stable trend with rate of change.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { WidgetProps } from "../types";
import { cn } from "@/lib/utils";

export function TemperatureTrendWidget({ readings = [] }: WidgetProps) {
  const trend = useMemo(() => {
    if (!readings || readings.length < 2) {
      return { direction: "stable" as const, rate: 0, confidence: "low" as const };
    }

    // Sort by time and get recent readings
    const sorted = [...readings].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );

    // Calculate trend from last hour of data
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const recentReadings = sorted.filter(
      r => new Date(r.recorded_at).getTime() > hourAgo
    );

    if (recentReadings.length < 2) {
      return { direction: "stable" as const, rate: 0, confidence: "low" as const };
    }

    const first = recentReadings[0];
    const last = recentReadings[recentReadings.length - 1];
    const tempChange = last.temperature - first.temperature;
    const timeChange = (new Date(last.recorded_at).getTime() - new Date(first.recorded_at).getTime()) / (60 * 60 * 1000); // hours

    const ratePerHour = tempChange / timeChange;
    
    let direction: "rising" | "falling" | "stable" = "stable";
    if (ratePerHour > 0.5) direction = "rising";
    else if (ratePerHour < -0.5) direction = "falling";

    const confidence = recentReadings.length > 5 ? "high" : "medium";

    return { direction, rate: ratePerHour, confidence };
  }, [readings]);

  const trendConfig = {
    rising: {
      icon: TrendingUp,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      label: "Rising",
    },
    falling: {
      icon: TrendingDown,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      label: "Falling",
    },
    stable: {
      icon: Minus,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      label: "Stable",
    },
  };

  const config = trendConfig[trend.direction];
  const Icon = config.icon;

  if (readings.length < 2) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Temperature Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-4">
          Insufficient data for trend analysis
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Temperature Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center gap-4">
          <div className={cn("p-3 rounded-full", config.bgColor)}>
            <Icon className={cn("h-8 w-8", config.color)} />
          </div>
          <div>
            <p className={cn("text-2xl font-bold", config.color)}>{config.label}</p>
            <p className="text-sm text-muted-foreground">
              {Math.abs(trend.rate).toFixed(1)}°/hour
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3 capitalize">
          {trend.confidence} confidence
        </p>
      </CardContent>
    </Card>
  );
}
