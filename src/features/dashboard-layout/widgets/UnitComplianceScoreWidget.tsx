/**
 * Unit Compliance Score Widget
 * 
 * Shows overall compliance percentage with breakdown.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, Thermometer, ClipboardList, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps } from "../types";

interface ComplianceMetrics {
  readingCompliance: number;
  manualLogCompliance: number;
  alertResponseCompliance: number;
  overall: number;
}

export function UnitComplianceScoreWidget({ entityId }: WidgetProps) {
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function calculateCompliance() {
      if (!entityId) {
        setIsLoading(false);
        return;
      }

      try {
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Get reading count (expect ~144 readings for 10-min intervals)
        const { count: readingCount } = await supabase
          .from("sensor_readings")
          .select("*", { count: "exact", head: true })
          .eq("unit_id", entityId)
          .gte("recorded_at", dayAgo.toISOString());

        const expectedReadings = 144; // 24h * 6 per hour
        const readingCompliance = Math.min(100, ((readingCount || 0) / expectedReadings) * 100);

        // Get manual log count (expect 6 for 4-hour intervals)
        const { count: logCount } = await supabase
          .from("manual_temperature_logs")
          .select("*", { count: "exact", head: true })
          .eq("unit_id", entityId)
          .gte("logged_at", dayAgo.toISOString());

        const expectedLogs = 6;
        const manualLogCompliance = Math.min(100, ((logCount || 0) / expectedLogs) * 100);

        // Get alert response (resolved alerts vs total)
        const { data: alerts } = await supabase
          .from("alerts")
          .select("resolved_at")
          .eq("unit_id", entityId)
          .gte("created_at", dayAgo.toISOString());

        const totalAlerts = alerts?.length || 0;
        const resolvedAlerts = alerts?.filter(a => a.resolved_at).length || 0;
        const alertResponseCompliance = totalAlerts > 0 
          ? (resolvedAlerts / totalAlerts) * 100 
          : 100; // No alerts = 100% compliance

        // Calculate overall (weighted average)
        const overall = (
          readingCompliance * 0.4 +
          manualLogCompliance * 0.3 +
          alertResponseCompliance * 0.3
        );

        setMetrics({
          readingCompliance,
          manualLogCompliance,
          alertResponseCompliance,
          overall,
        });
      } catch (err) {
        console.error("Error calculating compliance:", err);
      } finally {
        setIsLoading(false);
      }
    }

    calculateCompliance();
  }, [entityId]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Compliance Score
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-4">
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Compliance Score
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-4">
          Unable to calculate compliance
        </CardContent>
      </Card>
    );
  }

  const scoreColor = metrics.overall >= 90 
    ? "text-green-500" 
    : metrics.overall >= 70 
      ? "text-yellow-500" 
      : "text-destructive";

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />
          Compliance Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className={`text-4xl font-bold ${scoreColor}`}>
            {Math.round(metrics.overall)}%
          </p>
          <p className="text-xs text-muted-foreground">Overall Compliance</p>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Thermometer className="h-3 w-3" />
                Sensor Readings
              </span>
              <span className="font-medium">{Math.round(metrics.readingCompliance)}%</span>
            </div>
            <Progress value={metrics.readingCompliance} className="h-1.5" />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-muted-foreground">
                <ClipboardList className="h-3 w-3" />
                Manual Logs
              </span>
              <span className="font-medium">{Math.round(metrics.manualLogCompliance)}%</span>
            </div>
            <Progress value={metrics.manualLogCompliance} className="h-1.5" />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Bell className="h-3 w-3" />
                Alert Response
              </span>
              <span className="font-medium">{Math.round(metrics.alertResponseCompliance)}%</span>
            </div>
            <Progress value={metrics.alertResponseCompliance} className="h-1.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
