/**
 * Temperature Trend Widget
 * 
 * Shows rising, falling, or stable trend with rate of change.
 * Uses WidgetEmptyState for all non-healthy states.
 */

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { WidgetProps } from "../types";
import { cn } from "@/lib/utils";
import { createNotConfiguredState, createEmptyState, createHealthyState } from "../hooks/useWidgetState";
import { WidgetEmptyState } from "../components/WidgetEmptyState";

export function TemperatureTrendWidget({ readings = [], sensor, loraSensors }: WidgetProps) {
  const primarySensor = sensor || loraSensors?.find(s => s.is_primary) || loraSensors?.[0];
  
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

  // Determine widget state
  const widgetState = useMemo(() => {
    if (!primarySensor) {
      return createNotConfiguredState(
        "No sensor assigned to this unit.",
        "Assign a temperature sensor to enable trend analysis.",
        "Assign Sensor",
        "/settings/devices"
      );
    }
    
    if (!readings || readings.length === 0) {
      return createEmptyState(
        "Waiting for sensor readings...",
        "Data collection in progress"
      );
    }
    
    if (readings.length < 2) {
      return createEmptyState(
        "Need at least 2 readings for trend analysis.",
        "Data collection in progress"
      );
    }
    
    const lastDate = readings[0]?.recorded_at ? new Date(readings[0].recorded_at) : undefined;
    return createHealthyState(lastDate);
  }, [primarySensor, readings]);

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
      color: "text-safe",
      bgColor: "bg-safe/10",
      label: "Stable",
    },
  };

  const config = trendConfig[trend.direction];
  const Icon = config.icon;

  // Show empty state for non-healthy conditions
  if (widgetState.status !== "healthy") {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 p-4 pb-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="w-4 h-4" />
            Temperature Trend
          </h3>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <WidgetEmptyState state={widgetState} compact />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-4 pb-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <TrendingUp className="w-4 h-4" />
          Temperature Trend
        </h3>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
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
      </div>
    </div>
  );
}
