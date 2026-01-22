/**
 * TTN Diagnostics Panel
 * 
 * Shows cluster info, API URLs, and connection diagnostics for debugging.
 * NAM1 ONLY - standardized cluster for all organizations.
 */

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  Server, 
  Globe, 
  CheckCircle2, 
  XCircle,
  Info,
  Wifi
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TTNDiagnosticsData {
  ttn_region: string | null;
  ttn_application_id: string | null;
  provisioning_status: string | null;
  last_http_status: number | null;
  last_http_body: string | null;
  webhook_url: string | null;
  webhook_secret_last4: string | null;
  // Optional webhook health fields (if available)
  webhook_last_received_at?: string | null;
  webhook_last_status?: string | null;
}

interface TTNDiagnosticsPanelProps {
  data: TTNDiagnosticsData;
  className?: string;
}

// SINGLE CLUSTER - NAM1 is the only allowed endpoint
const CLUSTER_BASE_URL = "https://nam1.cloud.thethings.network";
const CLUSTER_HOST = "nam1.cloud.thethings.network";

const CLUSTER_CONFIG = {
  label: "NAM1 (North America)",
  baseUrl: CLUSTER_BASE_URL,
  host: CLUSTER_HOST,
  consoleUrl: "https://nam1.cloud.thethings.network/console",
  frequencyPlan: "US_902_928_FSB_2",
};

export function TTNDiagnosticsPanel({ data, className }: TTNDiagnosticsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentCluster = data.ttn_region || "nam1";
  const isProvisioned = data.provisioning_status === "ready";
  const lastHttpOk = data.last_http_status && data.last_http_status >= 200 && data.last_http_status < 300;
  
  // Verify cluster host matches expected
  const clusterHostMatches = currentCluster.toLowerCase() === "nam1";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-2">
        <Info className="h-4 w-4" />
        <span>TTN Diagnostics</span>
        <ChevronDown className={cn(
          "h-4 w-4 ml-auto transition-transform",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="mt-3 p-4 rounded-lg border bg-muted/30 space-y-4">
          {/* Single Cluster Info */}
          <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Cluster:
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {CLUSTER_CONFIG.label}
              </Badge>
              {clusterHostMatches ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-safe" />
              ) : (
                <Badge variant="outline" className="bg-alarm/10 text-alarm border-alarm/30 text-xs">
                  Host mismatch!
                </Badge>
              )}
            </div>

            <span className="text-muted-foreground flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" />
              Base URL:
            </span>
            <code className="text-xs font-mono text-foreground/80 break-all">
              {CLUSTER_CONFIG.baseUrl}
            </code>

            <span className="text-muted-foreground">Host (all planes):</span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-foreground/80">
                {CLUSTER_CONFIG.host}
              </code>
              <Badge variant="outline" className="bg-safe/10 text-safe border-safe/30 text-xs">
                IS/JS/NS/AS ✓
              </Badge>
            </div>

            <span className="text-muted-foreground">Frequency Plan:</span>
            <code className="text-xs font-mono text-foreground/80">
              {CLUSTER_CONFIG.frequencyPlan}
            </code>
          </div>

          {/* Application Info */}
          {data.ttn_application_id && (
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm border-t pt-3">
              <span className="text-muted-foreground">Application:</span>
              <code className="text-xs font-mono text-foreground/80">
                {data.ttn_application_id}
              </code>

              <span className="text-muted-foreground">Status:</span>
              <div className="flex items-center gap-1.5">
                {isProvisioned ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-safe" />
                    <span className="text-safe text-xs">Ready</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-warning" />
                    <span className="text-warning text-xs">{data.provisioning_status || "Unknown"}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Last HTTP Status */}
          {data.last_http_status && (
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm border-t pt-3">
              <span className="text-muted-foreground">Last HTTP:</span>
              <div className="flex items-center gap-1.5">
                {lastHttpOk ? (
                  <Badge variant="outline" className="bg-safe/10 text-safe border-safe/30 text-xs">
                    {data.last_http_status} OK
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-alarm/10 text-alarm border-alarm/30 text-xs">
                    {data.last_http_status} Error
                  </Badge>
                )}
              </div>

              {data.last_http_body && !lastHttpOk && (
                <>
                  <span className="text-muted-foreground">Response:</span>
                  <pre className="text-xs font-mono text-alarm/80 whitespace-pre-wrap break-all max-h-24 overflow-auto">
                    {data.last_http_body.slice(0, 500)}
                  </pre>
                </>
              )}
            </div>
          )}

          {/* Webhook Info */}
          {data.webhook_url && (
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm border-t pt-3">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5" />
                Webhook:
              </span>
              <code className="text-xs font-mono text-foreground/80 break-all">
                {data.webhook_url}
              </code>

              {data.webhook_secret_last4 && (
                <>
                  <span className="text-muted-foreground">Secret:</span>
                  <span className="text-xs">
                    ••••{data.webhook_secret_last4}
                  </span>
                </>
              )}

              {data.webhook_last_received_at && (
                <>
                  <span className="text-muted-foreground">Last Received:</span>
                  <span className="text-xs text-foreground/80">
                    {new Date(data.webhook_last_received_at).toLocaleString()}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Console Link */}
          <div className="pt-2 border-t">
            <a
              href={`${CLUSTER_CONFIG.consoleUrl}/applications/${data.ttn_application_id || ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Open in TTN Console (NAM1) →
            </a>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
