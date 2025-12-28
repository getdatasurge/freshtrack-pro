import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ThermometerSnowflake, Clock, AlertCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface LastKnownGoodCardProps {
  lastValidTemp: number | null;
  lastValidAt: string | null;
  source: "sensor" | "manual" | null;
  tempLimitHigh: number;
  tempLimitLow: number | null;
  isCurrentlyOnline: boolean;
}

const LastKnownGoodCard = ({
  lastValidTemp,
  lastValidAt,
  source,
  tempLimitHigh,
  tempLimitLow,
  isCurrentlyOnline,
}: LastKnownGoodCardProps) => {
  // Don't show if unit is currently online and has valid readings
  // This card is most useful when offline or when there's no current reading
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
      <Card className="border-dashed border-warning/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            No Temperature History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No valid temperature readings have been recorded for this unit yet.
            Wait for sensor data or log a manual temperature reading.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <ThermometerSnowflake className="w-5 h-5 text-accent" />
          Last Known Good Reading
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
};

export default LastKnownGoodCard;
