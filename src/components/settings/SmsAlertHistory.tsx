import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageSquare, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

interface SmsLogEntry {
  id: string;
  phone_number: string;
  from_number: string | null;
  alert_type: string;
  message: string;
  status: string;
  created_at: string;
  error_message: string | null;
  provider_message_id: string | null;
  delivery_updated_at: string | null;
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
  test: "Test SMS",
};

const statusConfig: Record<string, { icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline"; label: string; className: string }> = {
  sent: { icon: <Clock className="h-3 w-3" />, variant: "secondary", label: "Sent", className: "bg-muted text-muted-foreground border-border" },
  delivered: { icon: <CheckCircle className="h-3 w-3" />, variant: "default", label: "Delivered", className: "bg-safe/15 text-safe border-safe/30" },
  failed: { icon: <XCircle className="h-3 w-3" />, variant: "destructive", label: "Failed", className: "bg-destructive/15 text-destructive border-destructive/30" },
  pending: { icon: <Clock className="h-3 w-3" />, variant: "secondary", label: "Pending", className: "bg-muted text-muted-foreground border-border" },
  rate_limited: { icon: <AlertTriangle className="h-3 w-3" />, variant: "outline", label: "Rate Limited", className: "bg-warning/15 text-warning border-warning/30" },
};

// Helper to format phone number for display
const formatPhoneDisplay = (phone: string): string => {
  // Try to format US/Canada numbers nicely
  const match = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
};

// Telnyx error code mappings for user-friendly messages
const getTelnyxErrorMessage = (error: string): string => {
  // Authentication errors
  if (error.includes("10009") || error.includes("Authentication")) {
    return "SMS authentication failed. Contact support.";
  }
  if (error.includes("10014") || error.includes("permission")) {
    return "API key lacks required permissions.";
  }
  
  // Number validity errors
  if (error.includes("40310") || error.includes("40311") || error.includes("Invalid destination")) {
    return "Invalid phone number or not SMS-capable";
  }
  if (error.includes("40312") || error.includes("40313") || error.includes("Invalid source")) {
    return "Sender number configuration issue";
  }
  
  // Opt-out errors
  if (error.includes("40300") || error.includes("40301") || error.includes("opted out")) {
    return "Number opted out. Reply START to re-enable.";
  }
  
  // Routing errors
  if (error.includes("40001") || error.includes("landline") || error.includes("not routable")) {
    return "Cannot send SMS to this number (landline?)";
  }
  if (error.includes("40004") || error.includes("country not enabled")) {
    return "Destination country not enabled for SMS";
  }
  
  // Carrier/blocking errors
  if (error.includes("40002") || error.includes("40003") || error.includes("blocked") || error.includes("spam")) {
    return "Message blocked by carrier";
  }
  if (error.includes("40005") || error.includes("policy violation")) {
    return "Message content rejected";
  }
  
  // Delivery errors
  if (error.includes("40400") || error.includes("unreachable")) {
    return "Number temporarily unreachable";
  }
  if (error.includes("40401") || error.includes("40402") || error.includes("delivery")) {
    return "Delivery failed - carrier error";
  }
  
  // Account errors
  if (error.includes("20100") || error.includes("funds") || error.includes("balance")) {
    return "SMS service unavailable. Contact support.";
  }
  
  // Rate limiting
  if (error.includes("rate") || error.includes("limit")) {
    return "Rate limited. Wait before retrying.";
  }
  
  // Service errors
  if (error.includes("50000") || error.includes("50001") || error.includes("Internal")) {
    return "SMS service temporarily unavailable";
  }
  
  // Truncate long error messages
  if (error.length > 60) {
    return error.substring(0, 57) + "...";
  }
  return error;
};

interface SmsAlertHistoryProps {
  organizationId: string | null;
}

export function SmsAlertHistory({ organizationId }: SmsAlertHistoryProps) {
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: logs, isLoading, isRefetching } = useQuery({
    queryKey: ["sms-alert-history", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("sms_alert_log")
        .select("id, phone_number, from_number, alert_type, message, status, created_at, error_message, provider_message_id, delivery_updated_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as SmsLogEntry[];
    },
    enabled: !!organizationId,
  });

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["sms-alert-history", organizationId] });
  };

  const copyMessageId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("Copied Message ID to clipboard");
  };

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              SMS Alert History
            </CardTitle>
            <CardDescription>Recent SMS alerts sent to your team (last 20)</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs && logs.length > 0 ? (
          <div className="space-y-2">
            {logs.map((log) => {
              const status = statusConfig[log.status] || statusConfig.pending;
              const alertLabel = alertTypeLabels[log.alert_type] || log.alert_type;
              const isExpanded = expandedIds.has(log.id);
              
              return (
                <Collapsible 
                  key={log.id} 
                  open={isExpanded} 
                  onOpenChange={() => toggleExpanded(log.id)}
                >
                  <div className={`border rounded-lg transition-colors ${log.status === 'failed' ? 'border-destructive/30 bg-destructive/5' : ''}`}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-start justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-lg">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="mt-0.5">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant="outline" className={status.className}>
                                <span className="flex items-center gap-1">
                                  {status.icon}
                                  {status.label}
                                </span>
                              </Badge>
                              <Badge variant="outline">{alertLabel}</Badge>
                            </div>
                            {log.status === 'failed' && log.error_message && (
                              <p className="text-xs text-destructive mt-1">
                                {getTelnyxErrorMessage(log.error_message)}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground truncate mt-1" title={log.message}>
                              {log.message.length > 60 ? log.message.substring(0, 57) + "..." : log.message}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground ml-4 shrink-0">
                          <div title={format(new Date(log.created_at), "PPpp")}>
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </div>
                          <div className="font-mono mt-1">To: {formatPhoneDisplay(log.phone_number)}</div>
                          {log.from_number && (
                            <div className="font-mono text-muted-foreground/70">
                              From: {formatPhoneDisplay(log.from_number)}
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-0 border-t mx-3 mt-0">
                        <div className="grid gap-3 pt-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Full Message:</span>
                            <p className="mt-1 p-2 bg-muted/50 rounded text-xs font-mono whitespace-pre-wrap">
                              {log.message}
                            </p>
                          </div>
                          
                          {log.provider_message_id && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Message ID:</span>
                              <code className="text-xs bg-muted px-2 py-1 rounded">{log.provider_message_id}</code>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyMessageId(log.provider_message_id!);
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}

                          {log.error_message && (
                            <div>
                              <span className="text-muted-foreground">Error Details:</span>
                              <p className="mt-1 p-2 bg-destructive/10 text-destructive rounded text-xs">
                                {log.error_message}
                              </p>
                            </div>
                          )}
                          
                          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                            <span>Sent: {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm:ss a")}</span>
                            {log.delivery_updated_at && (
                              <span className="text-safe">
                                Delivered: {format(new Date(log.delivery_updated_at), "MMM d, yyyy 'at' h:mm:ss a")}
                              </span>
                            )}
                            {log.status === 'sent' && !log.delivery_updated_at && (
                              <span className="text-muted-foreground italic flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Awaiting delivery confirmation...
                              </span>
                            )}
                            {log.from_number && (
                              <span>From: {formatPhoneDisplay(log.from_number)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
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
