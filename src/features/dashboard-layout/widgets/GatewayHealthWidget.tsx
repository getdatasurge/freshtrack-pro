/**
 * Gateway Health Widget
 *
 * Displays gateway status for a site — count, individual status indicators,
 * last seen timestamps, and signal quality. Read-only; config remains in Settings.
 */

import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Radio, Settings, Loader2 } from "lucide-react";
import { useGatewaysBySite } from "@/hooks/useGateways";
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
  const { data: gateways = [], isLoading } = useGatewaysBySite(site?.id ?? null);

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
            <Link
              to="/settings?tab=gateways"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Settings className="h-3 w-3" />
              Settings &gt; Gateways
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {gateways.map((gw) => {
              const indicator = STATUS_INDICATOR[gw.status] || STATUS_INDICATOR.offline;
              return (
                <div
                  key={gw.id}
                  className="flex items-center gap-3 p-2 rounded-md border bg-card"
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
