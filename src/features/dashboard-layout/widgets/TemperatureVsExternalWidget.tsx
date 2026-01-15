/**
 * Temperature vs External Widget
 * 
 * Compares internal unit temperature with external weather temperature.
 * Shows a dual-line chart for comparison over time.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CloudSun, Thermometer, ArrowRight, MapPin, TrendingUp } from "lucide-react";
import { useWeatherHistory } from "@/hooks/useWeather";
import { isValidLocation } from "@/lib/weather/weatherService";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts";
import { format, subHours } from "date-fns";
import type { WidgetProps } from "../types";

export function TemperatureVsExternalWidget({ unit, readings = [], site }: WidgetProps) {
  const hasLocation = isValidLocation(site?.latitude, site?.longitude);
  
  // Time range: last 24 hours
  const endDate = useMemo(() => new Date(), []);
  const startDate = useMemo(() => subHours(endDate, 24), [endDate]);
  
  const { 
    data: weatherHistory, 
    isLoading: weatherLoading 
  } = useWeatherHistory(
    site?.latitude,
    site?.longitude,
    site?.timezone ?? "auto",
    startDate,
    endDate
  );

  // Combine internal readings with external weather
  const chartData = useMemo(() => {
    if (!readings || readings.length === 0) return [];

    // Create hourly buckets
    const hourlyData: Record<string, { hour: string; internal: number | null; external: number | null; count: number }> = {};

    // Add internal readings
    readings.forEach((reading) => {
      const hourKey = format(new Date(reading.recorded_at), "yyyy-MM-dd HH:00");
      if (!hourlyData[hourKey]) {
        hourlyData[hourKey] = { hour: hourKey, internal: null, external: null, count: 0 };
      }
      // Average multiple readings in same hour
      if (hourlyData[hourKey].internal === null) {
        hourlyData[hourKey].internal = reading.temperature;
        hourlyData[hourKey].count = 1;
      } else {
        hourlyData[hourKey].internal = 
          (hourlyData[hourKey].internal! * hourlyData[hourKey].count + reading.temperature) / 
          (hourlyData[hourKey].count + 1);
        hourlyData[hourKey].count++;
      }
    });

    // Add external weather data
    if (weatherHistory) {
      weatherHistory.forEach((weather) => {
        const hourKey = format(new Date(weather.time), "yyyy-MM-dd HH:00");
        if (!hourlyData[hourKey]) {
          hourlyData[hourKey] = { hour: hourKey, internal: null, external: null, count: 0 };
        }
        hourlyData[hourKey].external = weather.temperature;
      });
    }

    // Convert to array and sort
    return Object.values(hourlyData)
      .sort((a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime())
      .map((d) => ({
        ...d,
        internal: d.internal !== null ? Math.round(d.internal * 10) / 10 : null,
        external: d.external !== null ? Math.round(d.external * 10) / 10 : null,
        displayHour: format(new Date(d.hour), "ha"),
      }));
  }, [readings, weatherHistory]);

  const currentTemp = unit?.last_temp_reading ?? null;
  const currentExternal = weatherHistory && weatherHistory.length > 0 
    ? weatherHistory[weatherHistory.length - 1].temperature 
    : null;

  // Calculate difference
  const tempDiff = currentTemp !== null && currentExternal !== null
    ? Math.round((currentTemp - currentExternal) * 10) / 10
    : null;

  // No readings at all
  if (!readings || readings.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Temp vs External
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No temperature data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Temp vs External
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Current comparison */}
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="p-2 rounded-full bg-blue-500/10 mb-1 inline-block">
              <Thermometer className="h-6 w-6 text-blue-500" />
            </div>
            <p className="text-xl font-bold">
              {currentTemp !== null ? `${currentTemp.toFixed(1)}°` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Internal</p>
          </div>

          <div className="flex flex-col items-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            {tempDiff !== null && (
              <span className={`text-xs font-medium mt-1 ${tempDiff > 0 ? 'text-orange-500' : 'text-blue-500'}`}>
                {tempDiff > 0 ? '+' : ''}{tempDiff}°
              </span>
            )}
          </div>

          <div className="text-center">
            <div className="p-2 rounded-full bg-orange-500/10 mb-1 inline-block">
              <CloudSun className="h-6 w-6 text-orange-500" />
            </div>
            <p className="text-xl font-bold">
              {currentExternal !== null ? `${Math.round(currentExternal)}°` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">External</p>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="flex-1 min-h-[120px]">
            <ChartContainer
              config={{
                internal: { label: "Internal", color: "hsl(217, 91%, 60%)" },
                external: { label: "External", color: "hsl(25, 95%, 53%)" },
              }}
              className="h-full w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis 
                    dataKey="displayHour" 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}°`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="internal"
                    stroke="hsl(217, 91%, 60%)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="external"
                    stroke="hsl(25, 95%, 53%)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    strokeDasharray="4 2"
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: 10 }}
                    iconSize={8}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        )}

        {/* No location warning */}
        {!hasLocation && (
          <div className="flex items-center gap-2 p-2 rounded bg-muted text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>Set site location for external weather data</span>
          </div>
        )}

        {weatherLoading && hasLocation && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Skeleton className="h-3 w-3 rounded-full" />
            <span>Loading weather data...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
