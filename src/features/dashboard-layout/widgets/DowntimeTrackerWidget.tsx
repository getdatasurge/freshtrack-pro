/**
 * Downtime Tracker Widget
 * 
 * Displays offline intervals detected from gaps in sensor readings.
 * Shows total downtime, interval count, and longest interval.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Timer, WifiOff, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { findDowntimeIntervals, calculateUptimePercentage, DEFAULT_OFFLINE_THRESHOLD_MS } from "@/lib/downtime/gapDetection";
import { format, subDays } from "date-fns";
import type { WidgetProps } from "../types";

export function DowntimeTrackerWidget({ entityType, entityId, unit, site }: WidgetProps) {
  // Time range: last 7 days
  const timeRange = useMemo(() => ({
    start: subDays(new Date(), 7),
    end: new Date(),
  }), []);

  // Fetch readings for the time range
  const { data: downtimeSummary, isLoading } = useQuery({
    queryKey: ["downtime-tracker", entityType, entityId],
    queryFn: async () => {
      if (entityType === "unit" && entityId) {
        // Get primary sensor for the unit
        const { data: sensor } = await supabase
          .from("lora_sensors")
          .select("id")
          .eq("unit_id", entityId)
          .eq("is_primary", true)
          .single();

        if (!sensor) {
          return { 
            intervals: [], 
            totalDowntimeMs: 0, 
            totalDowntimeFormatted: "0m",
            intervalCount: 0,
            longestInterval: null,
          };
        }

        // Get readings for the time range
        const { data: readings } = await supabase
          .from("sensor_readings")
          .select("recorded_at")
          .eq("lora_sensor_id", sensor.id)
          .gte("recorded_at", timeRange.start.toISOString())
          .lte("recorded_at", timeRange.end.toISOString())
          .order("recorded_at");

        return findDowntimeIntervals(readings ?? [], DEFAULT_OFFLINE_THRESHOLD_MS, timeRange);
      }

      if (entityType === "site" && site?.id) {
        // Get all areas for the site
        const { data: areas } = await supabase
          .from("areas")
          .select("id")
          .eq("site_id", site.id)
          .is("deleted_at", null);

        if (!areas || areas.length === 0) {
          return { 
            intervals: [], 
            totalDowntimeMs: 0, 
            totalDowntimeFormatted: "0m",
            intervalCount: 0,
            longestInterval: null,
          };
        }

        // Get all units for the site
        const { data: units } = await supabase
          .from("units")
          .select("id")
          .in("area_id", areas.map((a) => a.id))
          .is("deleted_at", null);

        if (!units || units.length === 0) {
          return { 
            intervals: [], 
            totalDowntimeMs: 0, 
            totalDowntimeFormatted: "0m",
            intervalCount: 0,
            longestInterval: null,
          };
        }

        // Get primary sensors for all units
        const { data: sensors } = await supabase
          .from("lora_sensors")
          .select("id")
          .in("unit_id", units.map((u) => u.id))
          .eq("is_primary", true);

        if (!sensors || sensors.length === 0) {
          return { 
            intervals: [], 
            totalDowntimeMs: 0, 
            totalDowntimeFormatted: "0m",
            intervalCount: 0,
            longestInterval: null,
          };
        }

        // Get all readings for the time range
        const { data: readings } = await supabase
          .from("sensor_readings")
          .select("recorded_at")
          .in("lora_sensor_id", sensors.map((s) => s.id))
          .gte("recorded_at", timeRange.start.toISOString())
          .lte("recorded_at", timeRange.end.toISOString())
          .order("recorded_at");

        return findDowntimeIntervals(readings ?? [], DEFAULT_OFFLINE_THRESHOLD_MS, timeRange);
      }

      return { 
        intervals: [], 
        totalDowntimeMs: 0, 
        totalDowntimeFormatted: "0m",
        intervalCount: 0,
        longestInterval: null,
      };
    },
    enabled: !!entityId || !!site?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Calculate uptime percentage
  const uptimePercent = useMemo(() => {
    if (!downtimeSummary) return 100;
    const totalTimeMs = timeRange.end.getTime() - timeRange.start.getTime();
    return calculateUptimePercentage(totalTimeMs, downtimeSummary.totalDowntimeMs);
  }, [downtimeSummary, timeRange]);

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Downtime Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasDowntime = downtimeSummary && downtimeSummary.intervalCount > 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Downtime Tracker
          </CardTitle>
          <span className="text-xs text-muted-foreground">Last 7 days</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Uptime progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Uptime</span>
            <span className={`font-medium ${uptimePercent >= 99 ? 'text-green-500' : uptimePercent >= 95 ? 'text-yellow-500' : 'text-red-500'}`}>
              {uptimePercent.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={uptimePercent} 
            className="h-2"
          />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <WifiOff className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{downtimeSummary?.intervalCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">Outages</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{downtimeSummary?.totalDowntimeFormatted ?? "0m"}</p>
            <p className="text-xs text-muted-foreground">Total Downtime</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">
              {downtimeSummary?.longestInterval?.durationFormatted ?? "0m"}
            </p>
            <p className="text-xs text-muted-foreground">Longest</p>
          </div>
        </div>

        {/* Interval list */}
        {hasDowntime ? (
          <div className="flex-1 overflow-hidden">
            <p className="text-xs text-muted-foreground mb-2">Recent outages</p>
            <ScrollArea className="h-full max-h-[150px]">
              <div className="space-y-2 pr-4">
                {downtimeSummary.intervals.slice(0, 10).map((interval, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      <span className="text-muted-foreground">
                        {format(interval.start, "MMM d, h:mm a")}
                      </span>
                    </div>
                    <span className="font-medium">{interval.durationFormatted}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-green-500">
              <TrendingUp className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm font-medium">No downtime detected</p>
              <p className="text-xs text-muted-foreground">All systems operational</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
