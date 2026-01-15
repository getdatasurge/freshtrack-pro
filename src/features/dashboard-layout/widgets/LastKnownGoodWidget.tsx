/**
 * Last Known Good Widget
 * 
 * Displays the last known good temperature reading when sensor is offline.
 * Note: Card wrapper is provided by WidgetWrapper.
 */

import { Badge } from "@/components/ui/badge";
import { CheckCircle, ThermometerSnowflake, Clock, AlertCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { WidgetProps } from "../types";

export function LastKnownGoodWidget({ 
  unit,
  lastKnownGood,
  derivedStatus,
}: WidgetProps) {
  const lastValidTemp = lastKnownGood?.temp ?? null;
  const lastValidAt = lastKnownGood?.at ?? null;
  const source = lastKnownGood?.source ?? null;
  const tempLimitHigh = unit?.temp_limit_high ?? 40;
  const tempLimitLow = unit?.temp_limit_low ?? null;
  const isCurrentlyOnline = derivedStatus?.isOnline ?? false;

  // Don't show if unit is currently online and has valid readings
  if (isCurrentlyOnline && lastValidTemp !== null) {
    return null;
  }

  const isInRange = lastValidTemp !== null && 
    lastValidTemp <= tempLimitHigh && 
    (tempLimitLow === null || lastValidTemp >= tempLimitLow);

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    try {
      const date = new Date(timestamp);
      return `${formatDistanceToNow(date, { addSuffix: true })} (${format(date, "MMM d, h:mm a")})`;
    } catch {
      return "Unknown";
    }
  };

  // No valid data ever recorded
  if (lastValidTemp === null || lastValidAt === null) {
    return (
      <div className="h-full p-4 border-dashed border-warning/50">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-warning" />
          <h3 className="text-lg font-semibold">No Temperature History</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          No valid temperature readings have been recorded for this unit yet.
          Wait for sensor data or log a manual temperature reading.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full p-4 bg-accent/5">
      <div className="flex items-center gap-2 mb-2">
        <ThermometerSnowflake className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold">Last Known Good Reading</h3>
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-3xl font-bold ${isInRange ? "text-safe" : "text-alarm"}`}>
              {lastValidTemp.toFixed(1)}°F
            </span>
            {isInRange ? (
              <Badge className="bg-safe/10 text-safe border-0">
                <CheckCircle className="w-3 h-3 mr-1" />
                In Range
              </Badge>
            ) : (
              <Badge className="bg-alarm/10 text-alarm border-0">
                <AlertCircle className="w-3 h-3 mr-1" />
                Out of Range
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{formatTime(lastValidAt)}</span>
            {source && (
              <Badge variant="outline" className="text-xs">
                {source === "sensor" ? "Sensor" : "Manual Log"}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        This was the last valid temperature before the sensor went offline.
        Monitor this unit and log manual readings until the sensor reconnects.
      </p>
    </div>
  );
}
