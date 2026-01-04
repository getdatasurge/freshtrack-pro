import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RefreshCw, ChevronDown, ChevronRight, Clock, CheckCircle, XCircle, AlertTriangle, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ProvisioningLog {
  id: string;
  created_at: string;
  step: string;
  status: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  duration_ms: number | null;
  request_id: string | null;
  ttn_http_status: number | null;
  ttn_response_body: string | null;
  error_category: string | null;
  ttn_endpoint: string | null;
}

interface TTNProvisioningLogsProps {
  organizationId: string | null;
}

const stepLabels: Record<string, string> = {
  preflight: "Preflight Check",
  create_organization: "Create Organization",
  create_org_api_key: "Create Org API Key",
  create_application: "Create Application",
  verify_application_rights: "Verify App Rights",
  create_api_key: "Create API Key",
  create_app_api_key: "Create App API Key",
  create_gateway_key: "Create Gateway Key",
  create_webhook: "Configure Webhook",
  delete_application: "Delete Application",
  delete_organization: "Delete Organization",
  delete_unowned_app: "Delete Unowned App",
  rotate_app_id: "Rotate App ID",
  complete: "Complete",
  finalize: "Finalize",
  error: "Error",
};

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  started: { icon: Clock, color: "text-blue-500", label: "Started" },
  success: { icon: CheckCircle, color: "text-green-500", label: "Success" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
  skipped: { icon: SkipForward, color: "text-yellow-500", label: "Skipped" },
};

export function TTNProvisioningLogs({ organizationId }: TTNProvisioningLogsProps) {
  const [logs, setLogs] = useState<ProvisioningLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async () => {
    if (!organizationId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ttn_provisioning_logs")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs((data as ProvisioningLog[]) || []);
    } catch (err) {
      console.error("Failed to fetch provisioning logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleExpanded = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  if (!organizationId) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">Provisioning Logs</CardTitle>
          <CardDescription>Recent TTN provisioning activity</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && logs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No provisioning logs yet
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {logs.map((log) => {
              const config = statusConfig[log.status] || statusConfig.started;
              const StatusIcon = config.icon;
              const isExpanded = expandedLogs.has(log.id);

              return (
                <Collapsible key={log.id} open={isExpanded} onOpenChange={() => toggleExpanded(log.id)}>
                  <div className="border rounded-lg p-2">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <StatusIcon className={cn("h-4 w-4 shrink-0", config.color)} />
                          <span className="font-medium text-sm truncate">
                            {stepLabels[log.step] || log.step}
                          </span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {config.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {log.duration_ms && (
                            <span className="text-xs text-muted-foreground">
                              {log.duration_ms}ms
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 pt-2 border-t space-y-2">
                        {log.message && (
                          <p className="text-sm text-muted-foreground">{log.message}</p>
                        )}
                        {log.error_category && (
                          <p className="text-xs">
                            <span className="font-medium text-muted-foreground">Error type:</span>{" "}
                            <span className="text-destructive">{log.error_category}</span>
                          </p>
                        )}
                        {log.ttn_http_status && (
                          <p className="text-xs">
                            <span className="font-medium text-muted-foreground">HTTP Status:</span>{" "}
                            <span className={log.ttn_http_status >= 400 ? "text-destructive" : "text-safe"}>
                              {log.ttn_http_status}
                            </span>
                          </p>
                        )}
                        {log.ttn_endpoint && (
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            Endpoint: {log.ttn_endpoint}
                          </p>
                        )}
                        {log.request_id && (
                          <p className="text-xs text-muted-foreground font-mono">
                            Request ID: {log.request_id}
                          </p>
                        )}
                        {log.ttn_response_body && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              TTN Response
                            </summary>
                            <pre className="mt-1 bg-muted p-2 rounded overflow-x-auto text-xs">
                              {log.ttn_response_body}
                            </pre>
                          </details>
                        )}
                        {log.payload && Object.keys(log.payload).length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              Payload Details
                            </summary>
                            <pre className="mt-1 bg-muted p-2 rounded overflow-x-auto text-xs">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
