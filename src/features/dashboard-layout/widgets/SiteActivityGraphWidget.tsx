/**
 * Site Activity Graph Widget
 * 
 * Shows reading frequency sparklines for all units in the site.
 * Helps visualize sensor activity patterns at a glance.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subHours, format, startOfHour } from "date-fns";
import type { WidgetProps } from "../types";

interface UnitActivity {
  id: string;
  name: string;
  areaName: string;
  hourlyReadings: number[]; // 24 hours of reading counts
  totalReadings: number;
  lastReadingAt: string | null;
}

export function SiteActivityGraphWidget({ site }: WidgetProps) {
  const now = useMemo(() => new Date(), []);
  const startTime = useMemo(() => subHours(now, 24), [now]);

  // Fetch units and their recent readings
  const { data: activityData, isLoading } = useQuery({
    queryKey: ["site-activity-graph", site?.id],
    queryFn: async () => {
      if (!site?.id) return [];

      // Get areas for the site
      const { data: areas } = await supabase
        .from("areas")
        .select("id, name")
        .eq("site_id", site.id)
        .is("deleted_at", null);

      if (!areas || areas.length === 0) return [];

      const areaIds = areas.map((a) => a.id);
      const areaMap = Object.fromEntries(areas.map((a) => [a.id, a.name]));

      // Get units
      const { data: units } = await supabase
        .from("units")
        .select("id, name, area_id, last_reading_at")
        .in("area_id", areaIds)
        .is("deleted_at", null)
        .order("name");

      if (!units || units.length === 0) return [];

      // Get primary sensors for all units
      const { data: sensors } = await supabase
        .from("lora_sensors")
        .select("id, unit_id")
        .in("unit_id", units.map((u) => u.id))
        .eq("is_primary", true);

      if (!sensors || sensors.length === 0) return [];

      const sensorIds = sensors.map((s) => s.id);
      const sensorToUnit = Object.fromEntries(sensors.map((s) => [s.id, s.unit_id]));

      // Get readings for the last 24 hours
      const { data: readings } = await supabase
        .from("sensor_readings")
        .select("lora_sensor_id, recorded_at")
        .in("lora_sensor_id", sensorIds)
        .gte("recorded_at", startTime.toISOString())
        .order("recorded_at");

      // Group readings by unit and hour
      const unitReadings: Record<string, { byHour: Record<string, number>; total: number }> = {};

      units.forEach((u) => {
        unitReadings[u.id] = { byHour: {}, total: 0 };
      });

      readings?.forEach((r) => {
        const unitId = sensorToUnit[r.lora_sensor_id];
        if (!unitId || !unitReadings[unitId]) return;

        const hourKey = format(startOfHour(new Date(r.recorded_at)), "yyyy-MM-dd HH:00");
        unitReadings[unitId].byHour[hourKey] = (unitReadings[unitId].byHour[hourKey] || 0) + 1;
        unitReadings[unitId].total++;
      });

      // Build activity data
      const result: UnitActivity[] = units.map((unit) => {
        const hourlyReadings: number[] = [];
        
        // Build 24 hours of data
        for (let i = 23; i >= 0; i--) {
          const hourStart = subHours(now, i);
          const hourKey = format(startOfHour(hourStart), "yyyy-MM-dd HH:00");
          hourlyReadings.push(unitReadings[unit.id].byHour[hourKey] || 0);
        }

        return {
          id: unit.id,
          name: unit.name,
          areaName: areaMap[unit.area_id!] || "",
          hourlyReadings,
          totalReadings: unitReadings[unit.id].total,
          lastReadingAt: unit.last_reading_at,
        };
      });

      // Sort by total readings (most active first)
      return result.sort((a, b) => b.totalReadings - a.totalReadings);
    },
    enabled: !!site?.id,
    staleTime: 60000,
  });

  // Simple SVG sparkline component
  const Sparkline = ({ data }: { data: number[] }) => {
    const max = Math.max(...data, 1);
    const width = 100;
    const height = 20;
    const points = data
      .map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (val / max) * height;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg width={width} height={height} className="shrink-0">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-primary"
        />
      </svg>
    );
  };

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Site Activity Graph
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-24 ml-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activityData || activityData.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Site Activity Graph
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No activity data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Site Activity Graph
          </CardTitle>
          <span className="text-xs text-muted-foreground">Last 24 hours</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-2 pr-4">
            {activityData.map((unit) => (
              <div 
                key={unit.id} 
                className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{unit.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{unit.areaName}</p>
                </div>
                <Sparkline data={unit.hourlyReadings} />
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {unit.totalReadings} reads
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
