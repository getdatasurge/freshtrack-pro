import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface SmsLogEntry {
  id: string;
  phone_number: string;
  alert_type: string;
  message: string;
  status: string;
  created_at: string;
  error_message: string | null;
}

const alertTypeLabels: Record<string, string> = {
  alarm_active: "Temperature Alarm",
  monitoring_interrupted: "Offline",
  missed_manual_entry: "Missed Log",
  low_battery: "Low Battery",
  sensor_fault: "Sensor Fault",
  door_open: "Door Open",
  calibration_due: "Calibration Due",
  suspected_cooling_failure: "Cooling Failure",
  temp_excursion: "Temp Excursion",
};

const statusConfig: Record<string, { icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  sent: { icon: <CheckCircle className="h-3 w-3" />, variant: "default", label: "Sent" },
  failed: { icon: <XCircle className="h-3 w-3" />, variant: "destructive", label: "Failed" },
  pending: { icon: <Clock className="h-3 w-3" />, variant: "secondary", label: "Pending" },
  rate_limited: { icon: <AlertTriangle className="h-3 w-3" />, variant: "outline", label: "Rate Limited" },
};

interface SmsAlertHistoryProps {
  organizationId: string | null;
}

export function SmsAlertHistory({ organizationId }: SmsAlertHistoryProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["sms-alert-history", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("sms_alert_log")
        .select("id, phone_number, alert_type, message, status, created_at, error_message")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as SmsLogEntry[];
    },
    enabled: !!organizationId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Alert History
          </CardTitle>
          <CardDescription>Recent SMS alerts sent to your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          SMS Alert History
        </CardTitle>
        <CardDescription>Recent SMS alerts sent to your team (last 20)</CardDescription>
      </CardHeader>
      <CardContent>
        {logs && logs.length > 0 ? (
          <div className="space-y-3">
            {logs.map((log) => {
              const status = statusConfig[log.status] || statusConfig.pending;
              const alertLabel = alertTypeLabels[log.alert_type] || log.alert_type;
              
              return (
                <div key={log.id} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={status.variant} className="flex items-center gap-1">
                        {status.icon}
                        {status.label}
                      </Badge>
                      <Badge variant="outline">{alertLabel}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate" title={log.message}>
                      {log.message}
                    </p>
                    {log.error_message && (
                      <p className="text-xs text-destructive mt-1">{log.error_message}</p>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground ml-4 shrink-0">
                    <div>{format(new Date(log.created_at), "MMM d, h:mm a")}</div>
                    <div className="font-mono">{log.phone_number.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, "$1 ($2) $3-$4")}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No SMS alerts sent yet</p>
            <p className="text-sm">SMS alerts will appear here when triggered</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
