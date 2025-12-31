import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight,
  Radio,
  Cpu,
  Thermometer,
  Clock,
  Database
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface EmulatorSyncHistoryProps {
  organizationId: string | null;
}

interface SyncCounts {
  gateways?: { created: number; updated: number };
  devices?: { created: number; updated: number };
  sensors?: { created: number; updated: number };
}

interface SyncRun {
  id: string;
  organization_id: string;
  sync_id: string | null;
  synced_at: string;
  processed_at: string;
  status: string;
  counts: SyncCounts;
  warnings: string[];
  errors: string[];
  payload_summary: {
    gateways_count?: number;
    devices_count?: number;
    sensors_count?: number;
  } | null;
  created_at: string;
}

export function EmulatorSyncHistory({ organizationId }: EmulatorSyncHistoryProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: syncRuns, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["emulator-sync-history", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emulator_sync_runs")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data as SyncRun[];
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

  const formatEntityCounts = (counts: SyncCounts, entity: keyof SyncCounts) => {
    const data = counts[entity];
    if (!data) return null;
    const parts = [];
    if (data.created > 0) parts.push(`${data.created} created`);
    if (data.updated > 0) parts.push(`${data.updated} updated`);
    return parts.length > 0 ? parts.join(", ") : "0";
  };

  if (!organizationId) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            Emulator Sync History
          </CardTitle>
          <CardDescription>
            Recent sync runs from emulator ingestion (last 25)
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Loading sync history...
          </div>
        ) : !syncRuns || syncRuns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No sync runs recorded yet</p>
            <p className="text-sm">Sync runs will appear here after emulator data is ingested</p>
          </div>
        ) : (
          <div className="space-y-2">
            {syncRuns.map((run) => {
              const isExpanded = expandedIds.has(run.id);
              const hasWarnings = run.warnings && run.warnings.length > 0;
              const hasErrors = run.errors && run.errors.length > 0;
              const isPartial = run.status === "partial";

              return (
                <Collapsible
                  key={run.id}
                  open={isExpanded}
                  onOpenChange={() => toggleExpanded(run.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        
                        {isPartial ? (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Partial
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-safe/10 text-safe border-safe/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        )}

                        <div className="flex items-center gap-4 text-sm">
                          {run.counts.gateways && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Radio className="h-3.5 w-3.5" />
                              {formatEntityCounts(run.counts, "gateways")}
                            </span>
                          )}
                          {run.counts.devices && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Cpu className="h-3.5 w-3.5" />
                              {formatEntityCounts(run.counts, "devices")}
                            </span>
                          )}
                          {run.counts.sensors && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Thermometer className="h-3.5 w-3.5" />
                              {formatEntityCounts(run.counts, "sensors")}
                            </span>
                          )}
                        </div>

                        {(hasWarnings || hasErrors) && (
                          <div className="flex items-center gap-2">
                            {hasWarnings && (
                              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                                {run.warnings.length} warning{run.warnings.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                            {hasErrors && (
                              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                                {run.errors.length} error{run.errors.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span title={format(new Date(run.synced_at), "PPpp")}>
                          {formatDistanceToNow(new Date(run.synced_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="ml-7 mt-2 p-3 rounded-lg border bg-muted/30 space-y-3 text-sm">
                      {run.sync_id && (
                        <div>
                          <span className="text-muted-foreground">Sync ID: </span>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{run.sync_id}</code>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                        <div>
                          <span>Synced at: </span>
                          <span className="text-foreground">{format(new Date(run.synced_at), "PPpp")}</span>
                        </div>
                        <div>
                          <span>Processed at: </span>
                          <span className="text-foreground">{format(new Date(run.processed_at), "PPpp")}</span>
                        </div>
                      </div>

                      {run.payload_summary && (
                        <div>
                          <span className="text-muted-foreground">Payload: </span>
                          <span>
                            {run.payload_summary.gateways_count || 0} gateways, {" "}
                            {run.payload_summary.devices_count || 0} devices, {" "}
                            {run.payload_summary.sensors_count || 0} sensors
                          </span>
                        </div>
                      )}

                      {hasWarnings && (
                        <div>
                          <p className="font-medium text-warning mb-1">Warnings ({run.warnings.length}):</p>
                          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                            {run.warnings.map((warning, idx) => (
                              <li key={idx}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {hasErrors && (
                        <div>
                          <p className="font-medium text-destructive mb-1">Errors ({run.errors.length}):</p>
                          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                            {run.errors.map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {!hasWarnings && !hasErrors && (
                        <p className="text-safe">No warnings or errors</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
