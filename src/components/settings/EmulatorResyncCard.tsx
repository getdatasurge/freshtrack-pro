import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface EmulatorResyncCardProps {
  organizationId: string | null;
}

interface SyncLogEntry {
  id: string;
  user_id: string;
  event_type: string;
  payload: {
    ttn?: {
      enabled: boolean;
      provisioning_status: string;
      cluster: string | null;
      application_id: string | null;
      webhook_url: string | null;
      api_key_last4: string | null;
      webhook_secret_last4: string | null;
    };
  };
  status: string;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
}

export function EmulatorResyncCard({ organizationId }: EmulatorResyncCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch last sync log for current user
  const { data: lastSync, refetch: refetchSync } = useQuery({
    queryKey: ["user-sync-log", organizationId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_sync_log")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as SyncLogEntry | null;
    },
    enabled: !!organizationId,
  });

  const handleResync = async () => {
    if (!organizationId) {
      toast.error("No organization found");
      return;
    }

    setIsSyncing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update profile to trigger emit_user_sync database trigger
      const { error } = await supabase
        .from("profiles")
        .update({ updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Sync triggered - check Emulator in a few seconds");
      
      // Wait a moment then refetch to show new sync status
      setTimeout(() => {
        refetchSync();
      }, 2000);
    } catch (error) {
      console.error("[EmulatorResyncCard] Sync error:", error);
      toast.error(`Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const ttnPayload = lastSync?.payload?.ttn;
  const hasTtnConfig = ttnPayload?.enabled && ttnPayload?.application_id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Emulator Sync
        </CardTitle>
        <CardDescription>
          Manually trigger user sync to propagate TTN settings to the Emulator project
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button 
            onClick={handleResync} 
            disabled={isSyncing || !organizationId}
            variant="outline"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Force Sync to Emulator
              </>
            )}
          </Button>
        </div>

        {lastSync && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Last Sync</span>
              <div className="flex items-center gap-2">
                {lastSync.status === "sent" ? (
                  <Badge variant="outline" className="text-safe border-safe">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Sent
                  </Badge>
                ) : lastSync.status === "failed" ? (
                  <Badge variant="outline" className="text-alarm border-alarm">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Failed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-warning border-warning">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                )}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {new Date(lastSync.created_at).toLocaleString()}
            </div>

            {lastSync.last_error && (
              <div className="p-2 rounded bg-alarm/10 text-alarm text-sm">
                Error: {lastSync.last_error}
              </div>
            )}

            <div className="pt-2 border-t">
              <p className="text-sm font-medium mb-2">TTN Data in Payload</p>
              {hasTtnConfig ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Enabled:</span>{" "}
                    <span className="font-mono">{ttnPayload.enabled ? "Yes" : "No"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <span className="font-mono">{ttnPayload.provisioning_status || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cluster:</span>{" "}
                    <span className="font-mono">{ttnPayload.cluster || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">App ID:</span>{" "}
                    <span className="font-mono">{ttnPayload.application_id || "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Webhook URL:</span>{" "}
                    <span className="font-mono text-xs break-all">{ttnPayload.webhook_url || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">API Key:</span>{" "}
                    <span className="font-mono">
                      {ttnPayload.api_key_last4 ? `••••${ttnPayload.api_key_last4}` : "Not set"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Webhook Secret:</span>{" "}
                    <span className="font-mono">
                      {ttnPayload.webhook_secret_last4 ? `••••${ttnPayload.webhook_secret_last4}` : "Not set"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No TTN configuration in last sync payload
                </p>
              )}
            </div>
          </div>
        )}

        {!lastSync && organizationId && (
          <p className="text-sm text-muted-foreground">
            No sync history found. Click "Force Sync" to trigger initial sync.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
