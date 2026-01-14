/**
 * Maintenance Forecast Widget
 * 
 * Shows estimated battery replacement date and health score.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wrench, Battery, Calendar, AlertTriangle } from "lucide-react";
import type { WidgetProps } from "../types";
import { useBatteryForecast } from "@/hooks/useBatteryForecast";
import { format, addDays } from "date-fns";

export function MaintenanceForecastWidget({ sensor, loraSensors = [] }: WidgetProps) {
  // Use the primary sensor or first available
  const activeSensor = sensor || loraSensors[0];
  
  const batteryLevel = activeSensor?.battery_level ?? null;
  
  // Estimate days remaining based on battery level
  // Rough estimate: 1% = ~10 days for LoRa sensors
  const estimatedDaysRemaining = batteryLevel ? Math.max(0, batteryLevel * 10) : null;
  const estimatedReplacementDate = estimatedDaysRemaining 
    ? addDays(new Date(), estimatedDaysRemaining)
    : null;

  // Calculate health score based on battery and signal
  const signalStrength = activeSensor?.signal_strength ?? -100;
  const signalScore = Math.max(0, Math.min(100, ((signalStrength + 120) / 80) * 100));
  const batteryScore = batteryLevel ?? 50;
  const healthScore = Math.round((batteryScore * 0.6) + (signalScore * 0.4));

  const healthStatus = healthScore >= 80 
    ? "Excellent" 
    : healthScore >= 60 
      ? "Good" 
      : healthScore >= 40 
        ? "Fair" 
        : "Poor";

  const statusColor = healthScore >= 80 
    ? "text-green-500" 
    : healthScore >= 60 
      ? "text-blue-500" 
      : healthScore >= 40 
        ? "text-yellow-500" 
        : "text-destructive";

  if (!activeSensor) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-4">
          No sensor data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Maintenance Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Battery className={`h-6 w-6 ${statusColor}`} />
          </div>
          <div>
            <p className={`text-lg font-bold ${statusColor}`}>{healthStatus}</p>
            <p className="text-xs text-muted-foreground">
              Health Score: {healthScore}%
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Battery Level</span>
            <span className="font-medium">{batteryLevel ?? "—"}%</span>
          </div>
          <Progress value={batteryLevel ?? 0} className="h-2" />
        </div>

        {estimatedReplacementDate && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm">
              <p className="text-muted-foreground">Est. Battery Replacement</p>
              <p className="font-medium">
                {format(estimatedReplacementDate, "MMM d, yyyy")}
              </p>
            </div>
          </div>
        )}

        {healthScore < 40 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Maintenance recommended soon</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
