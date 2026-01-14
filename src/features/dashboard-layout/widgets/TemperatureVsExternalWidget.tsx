/**
 * Temperature vs External Widget
 * 
 * Compare internal temperature with ambient/external conditions.
 * MVP: Shows placeholder for weather API integration.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudSun, Thermometer, ArrowRight } from "lucide-react";
import type { WidgetProps } from "../types";

export function TemperatureVsExternalWidget({ unit, readings = [] }: WidgetProps) {
  const currentTemp = unit?.last_temp_reading ?? null;
  
  // Get average internal temp from readings
  const avgTemp = useMemo(() => {
    if (!readings || readings.length === 0) return null;
    const temps = readings.map(r => r.temperature);
    return temps.reduce((a, b) => a + b, 0) / temps.length;
  }, [readings]);

  // Placeholder for external weather data
  // In full implementation, this would fetch from a weather API
  const externalTemp = null; // Would come from weather API

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CloudSun className="h-4 w-4" />
          Temp vs External
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="p-3 rounded-full bg-blue-500/10 mb-2 inline-block">
              <Thermometer className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">
              {currentTemp !== null ? `${currentTemp.toFixed(1)}°` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Internal</p>
          </div>

          <ArrowRight className="h-5 w-5 text-muted-foreground" />

          <div className="text-center">
            <div className="p-3 rounded-full bg-orange-500/10 mb-2 inline-block">
              <CloudSun className="h-8 w-8 text-orange-500" />
            </div>
            <p className="text-2xl font-bold">
              {externalTemp !== null ? `${externalTemp}°` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">External</p>
          </div>
        </div>

        {avgTemp !== null && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Avg internal: {avgTemp.toFixed(1)}°
          </p>
        )}

        {externalTemp === null && (
          <p className="text-xs text-muted-foreground text-center mt-4 italic">
            External weather data requires API integration
          </p>
        )}
      </CardContent>
    </Card>
  );
}
