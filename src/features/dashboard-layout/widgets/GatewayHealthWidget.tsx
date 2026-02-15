/**
 * Gateway Health Widget
 *
 * Displays gateway status for a site — count, individual status indicators,
 * last seen timestamps, and signal quality. Clicking a gateway navigates
 * to the site's Settings tab where gateways can be managed.
 *
 * On mount, triggers a TTN status sync to fetch live connection stats.
 */

import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Radio, Settings, Loader2, AlertTriangle } from "lucide-react";
import { useGatewaysBySite, useSyncGatewayStatus } from "@/hooks/useGateways";
import { useCheckTtnGatewayState } from "@/hooks/useCheckTtnGatewayState";
import { formatDistanceToNowStrict } from "date-fns";
import type { WidgetProps } from "../types";
import type { GatewayStatus } from "@/types/ttn";

const STATUS_INDICATOR: Record<GatewayStatus, { dot: string; label: string }> = {
  online: { dot: "bg-green-500", label: "Online" },
  degraded: { dot: "bg-yellow-500", label: "Degraded" },
  offline: { dot: "bg-red-500", label: "Offline" },
  pending: { dot: "bg-gray-400", label: "Pending" },
  maintenance: { dot: "bg-gray-400", label: "Maintenance" },
};

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Never";
  try {
    return formatDistanceToNowStrict(new Date(lastSeenAt), { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

export function GatewayHealthWidget({ site }: WidgetProps) {
  const { siteId } = useParams();
  const { data: gateways = [], isLoading } = useGatewaysBySite(site?.id ?? null);
  const syncStatus = useSyncGatewayStatus();
  const checkTtn = useCheckTtnGatewayState();
  const hasVerified = useRef(false);

  const orgId = site?.organization_id;
  const currentSiteId = site?.id ?? siteId;

  // Auto-verify: check unlinked gateways on mount (only once)
  useEffect(() => {
    if (!orgId || hasVerified.current || isLoading || gateways.length === 0) return;
    const unlinked = gateways.filter(gw => !gw.ttn_gateway_id);
    if (unlinked.length === 0) {
      hasVerified.current = true;
      return;
    }
    hasVerified.current = true;
    checkTtn.mutate({ gatewayIds: unlinked.map(gw => gw.id) });
  }, [orgId, isLoading, gateways.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger TTN status sync on mount and every 60 seconds.
  // The edge function fetches live connection stats from TTN and
  // writes last_seen_at + status to the DB. Realtime propagates instantly.
  useEffect(() => {
    if (!orgId) return;
    // Sync immediately
    syncStatus.mutate({ organizationId: orgId });
    // Then every 60 seconds
    const interval = setInterval(() => {
      syncStatus.mutate({ organizationId: orgId });
    }, 60_000);
    return () => clearInterval(interval);
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for verify errors to show actionable messages
  const verifyError = checkTtn.isError ? checkTtn.error?.message : null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Server className="h-4 w-4" />
          Gateway Status
          {gateways.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs font-normal">
              {gateways.length} Gateway{gateways.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : gateways.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            <Radio className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground mb-1">
              No gateways assigned to this site
            </p>
            {currentSiteId ? (
              <Link
                to={`/sites/${currentSiteId}?tab=settings`}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <Settings className="h-3 w-3" />
                Manage Gateways in Settings
              </Link>
            ) : (
              <Link
                to="/settings?tab=gateways"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <Settings className="h-3 w-3" />
                Settings &gt; Gateways
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Show verify error banner if auto-verify failed */}
            {verifyError && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{verifyError}</span>
              </div>
            )}
            {gateways.map((gw) => {
              const indicator = STATUS_INDICATOR[gw.status] || STATUS_INDICATOR.offline;
              return (
                <div
                  key={gw.id}
                  className="flex items-center gap-3 p-2 rounded-md border bg-card hover:bg-muted/50 transition-colors"
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${indicator.dot}`}
                    title={indicator.label}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{gw.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {indicator.label} &middot; {formatLastSeen(gw.last_seen_at)}
                    </p>
                  </div>
                  {gw.signal_quality && typeof gw.signal_quality === "object" && "rssi" in gw.signal_quality && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap" title="Signal RSSI">
                      {String(gw.signal_quality.rssi)} dBm
                    </span>
                  )}
                </div>
              );
            })}
            {/* Link to manage gateways */}
            {currentSiteId && (
              <Link
                to={`/sites/${currentSiteId}?tab=settings`}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 pt-1"
              >
                <Settings className="h-3 w-3" />
                Manage Gateways
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
