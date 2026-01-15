/**
 * Current Temperature Widget
 * 
 * Displays the current temperature with live/offline indicator.
 * Note: Card wrapper is provided by WidgetWrapper.
 */

import { format } from "date-fns";
import { Wifi, WifiOff } from "lucide-react";

interface DerivedStatus {
  isOnline: boolean;
  statusLabel: string;
  statusColor: string;
  statusBgColor: string;
}

interface CurrentTempWidgetProps {
  temperature: number | null;
  tempLimitHigh: number;
  tempLimitLow: number | null;
  lastReadingAt: string | null;
  derivedStatus: DerivedStatus;
}

export function CurrentTempWidget({
  temperature,
  tempLimitHigh,
  tempLimitLow,
  lastReadingAt,
  derivedStatus,
}: CurrentTempWidgetProps) {
  const formatTemp = (temp: number | null) => {
    if (temp === null) return "--";
    return `${temp.toFixed(1)}°F`;
  };

  const getTempColor = () => {
    if (temperature === null) return "text-muted-foreground";
    if (temperature > tempLimitHigh) return "text-alarm";
    if (tempLimitLow !== null && temperature < tempLimitLow) return "text-accent";
    return "text-safe";
  };

  return (
    <div className="h-full p-4 pt-6 pb-4 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-muted-foreground">Current Temperature</p>
        <div className="flex items-center gap-1">
          {derivedStatus.isOnline ? (
            <Wifi className="w-4 h-4 text-safe" />
          ) : (
            <WifiOff className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground">
            {derivedStatus.isOnline ? "Live" : "Offline"}
          </span>
        </div>
      </div>
      <p className={`text-5xl font-bold ${getTempColor()}`}>
        {formatTemp(temperature)}
      </p>
      {lastReadingAt && (
        <p className="text-xs text-muted-foreground mt-auto pt-2">
          Last reading: {format(new Date(lastReadingAt), "MMM d, h:mm a")}
        </p>
      )}
    </div>
  );
}
