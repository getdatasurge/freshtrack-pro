/**
 * Manual Log Status Widget
 * 
 * Shows next log due, overdue indicator, streak, and compliance percentage.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ClipboardList, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps } from "../types";
import { formatDistanceToNow, isAfter, addHours } from "date-fns";

export function ManualLogStatusWidget({ entityId, site }: WidgetProps) {
  const [lastLog, setLastLog] = useState<{ logged_at: string } | null>(null);
  const [logCount, setLogCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchManualLogs() {
      if (!entityId) {
        setIsLoading(false);
        return;
      }

      try {
        // Get last log
        const { data: last } = await supabase
          .from("manual_temperature_logs")
          .select("logged_at")
          .eq("unit_id", entityId)
          .order("logged_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get count for last 24 hours
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from("manual_temperature_logs")
          .select("*", { count: "exact", head: true })
          .eq("unit_id", entityId)
          .gte("logged_at", dayAgo);

        setLastLog(last);
        setLogCount(count || 0);
      } catch (err) {
        console.error("Error fetching manual logs:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchManualLogs();
  }, [entityId]);

  const cadenceHours = site?.manual_log_cadence_seconds 
    ? site.manual_log_cadence_seconds / 3600 
    : 4; // Default 4 hours

  const expectedLogsPerDay = 24 / cadenceHours;
  const compliancePercent = Math.min(100, (logCount / expectedLogsPerDay) * 100);

  const nextDue = lastLog 
    ? addHours(new Date(lastLog.logged_at), cadenceHours)
    : new Date();
  const isOverdue = isAfter(new Date(), nextDue);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Manual Log Status
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-4">
          Loading...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Manual Log Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          {isOverdue ? (
            <AlertTriangle className="h-8 w-8 text-destructive" />
          ) : (
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          )}
          <div>
            <p className="text-sm font-medium">
              {isOverdue ? "Overdue" : "On Track"}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastLog ? (
                <>Next due {formatDistanceToNow(nextDue, { addSuffix: true })}</>
              ) : (
                "No logs recorded"
              )}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Today's compliance</span>
            <span className="font-medium">{Math.round(compliancePercent)}%</span>
          </div>
          <Progress value={compliancePercent} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {logCount} of {Math.round(expectedLogsPerDay)} expected logs
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
