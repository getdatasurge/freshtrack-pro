/**
 * Alert History Widget
 * 
 * Shows past alerts with resolution times and patterns.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps } from "../types";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";

interface HistoricalAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  created_at: string;
  resolved_at: string | null;
}

export function AlertHistoryWidget({ entityId }: WidgetProps) {
  const [alerts, setAlerts] = useState<HistoricalAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAlertHistory() {
      if (!entityId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("alerts")
          .select("id, alert_type, severity, title, created_at, resolved_at")
          .eq("unit_id", entityId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        setAlerts(data || []);
      } catch (err) {
        console.error("Error fetching alert history:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAlertHistory();
  }, [entityId]);

  const resolvedAlerts = alerts.filter(a => a.resolved_at);
  const avgResolutionTime = resolvedAlerts.length > 0
    ? resolvedAlerts.reduce((sum, a) => 
        sum + differenceInMinutes(new Date(a.resolved_at!), new Date(a.created_at)), 0
      ) / resolvedAlerts.length
    : 0;

  const severityColors = {
    critical: "bg-destructive text-destructive-foreground",
    warning: "bg-yellow-500 text-white",
    info: "bg-blue-500 text-white",
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Alert History
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Alert History
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
          No alerts recorded
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Alert History
          </span>
          {avgResolutionTime > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              Avg MTTR: {Math.round(avgResolutionTime)}m
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-2 rounded-lg border border-border"
              >
                {alert.resolved_at ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{alert.title}</p>
                    <Badge 
                      className={severityColors[alert.severity as keyof typeof severityColors] || "bg-muted"}
                      variant="secondary"
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    <span>{format(new Date(alert.created_at), "MMM d, h:mm a")}</span>
                    {alert.resolved_at && (
                      <span className="text-green-600">
                        • Resolved in {differenceInMinutes(new Date(alert.resolved_at), new Date(alert.created_at))}m
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
