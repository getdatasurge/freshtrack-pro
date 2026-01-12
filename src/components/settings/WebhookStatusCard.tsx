import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Webhook, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Settings2,
  AlertTriangle,
  Activity
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";

interface WebhookStatusCardProps {
  organizationId: string | null;
  canEdit: boolean;
}

interface WebhookConfig {
  id: string;
  webhook_id: string | null;
  webhook_url: string;
  status: "pending" | "active" | "error";
  last_event_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface WebhookStats {
  eventsToday: number;
  lastEventType: string | null;
}

const statusConfig = {
  active: { 
    icon: CheckCircle, 
    label: "Active", 
    className: "bg-safe/15 text-safe border-safe/30" 
  },
  pending: { 
    icon: Clock, 
    label: "Pending", 
    className: "bg-warning/15 text-warning border-warning/30" 
  },
  error: { 
    icon: XCircle, 
    label: "Error", 
    className: "bg-destructive/15 text-destructive border-destructive/30" 
  },
  not_configured: { 
    icon: AlertTriangle, 
    label: "Not Configured", 
    className: "bg-muted text-muted-foreground border-border" 
  },
};

export function WebhookStatusCard({ organizationId, canEdit }: WebhookStatusCardProps) {
  const queryClient = useQueryClient();
  const [isConfiguring, setIsConfiguring] = useState(false);

  // Fetch webhook config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["telnyx-webhook-config", organizationId],
    queryFn: async () => {
      // First try org-specific, then global
      const { data, error } = await supabase
        .from("telnyx_webhook_config")
        .select("*")
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .order("organization_id", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as WebhookConfig | null;
    },
    enabled: !!organizationId,
  });

  // Fetch webhook event stats
  const { data: stats } = useQuery({
    queryKey: ["telnyx-webhook-stats", organizationId],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Count events today
      const { count, error: countError } = await supabase
        .from("telnyx_webhook_events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString());

      if (countError) throw countError;

      // Get last event type
      const { data: lastEvent, error: lastError } = await supabase
        .from("telnyx_webhook_events")
        .select("event_type")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastError) throw lastError;

      return {
        eventsToday: count || 0,
        lastEventType: lastEvent?.event_type || null,
      } as WebhookStats;
    },
    enabled: !!organizationId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Configure webhook mutation
  const configureWebhook = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("telnyx-configure-webhook", {
        body: { 
          action: "configure",
          organization_id: organizationId 
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Webhook configured successfully!");
      queryClient.invalidateQueries({ queryKey: ["telnyx-webhook-config"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to configure webhook: ${error.message}`);
    },
  });

  const handleConfigure = async () => {
    setIsConfiguring(true);
    try {
      await configureWebhook.mutateAsync();
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["telnyx-webhook-config", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["telnyx-webhook-stats", organizationId] });
  };

  if (configLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const status = config?.status || "not_configured";
  const statusInfo = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_configured;
  const StatusIcon = statusInfo.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook Status
            </CardTitle>
            <CardDescription>
              Telnyx delivery status webhook for SMS tracking
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleRefresh}
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant="outline" className={statusInfo.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>

          {/* Last Event */}
          {config?.last_event_at && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Event</span>
              <div className="flex items-center gap-2 text-sm">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span title={format(new Date(config.last_event_at), "PPpp")}>
                  {formatDistanceToNow(new Date(config.last_event_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          )}

          {/* Events Today */}
          {stats && stats.eventsToday > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Events Today</span>
              <span className="text-sm font-medium">{stats.eventsToday}</span>
            </div>
          )}

          {/* Last Event Type */}
          {stats?.lastEventType && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Event Type</span>
              <Badge variant="secondary" className="text-xs">
                {stats.lastEventType.replace("message.", "")}
              </Badge>
            </div>
          )}

          {/* Error Message */}
          {config?.last_error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <p className="text-xs text-destructive">{config.last_error}</p>
            </div>
          )}

          {/* Configure Button */}
          {canEdit && (
            <div className="pt-2">
              {!config || status === "not_configured" || status === "error" ? (
                <Button 
                  onClick={handleConfigure}
                  disabled={isConfiguring}
                  className="w-full"
                  variant={status === "error" ? "destructive" : "default"}
                >
                  {isConfiguring ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Configuring...
                    </>
                  ) : (
                    <>
                      <Settings2 className="h-4 w-4 mr-2" />
                      {status === "error" ? "Reconfigure Webhook" : "Configure Webhook"}
                    </>
                  )}
                </Button>
              ) : (
                <p className="text-xs text-center text-muted-foreground">
                  Webhook is active and receiving delivery status updates
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
