/**
 * TTN Diagnostics Panel
 * 
 * Shows dual-endpoint architecture info, API URLs, and connection diagnostics.
 * Identity Server (EU1) + Data Planes (NAM1)
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
  Wifi,
  Database
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TTNProofStep {
  step: string;
  host: string;
  expected_host: string;
  match: boolean;
  status: number | null;
  error?: string;
}

interface TTNProofReport {
  request_id: string;
  timestamp: string;
  cli_equivalence: boolean;
  steps: TTNProofStep[];
  webhook_verification?: {
    base_url_match: boolean;
    secret_configured: boolean;
  };
}

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
  // Provisioning proof report (if available)
  proof_report?: TTNProofReport | null;
}

interface TTNDiagnosticsPanelProps {
  data: TTNDiagnosticsData;
  className?: string;
}

// DUAL-ENDPOINT ARCHITECTURE
// Identity Server (IS): EU1 - global registry
// Data Planes (NS/AS/JS): NAM1 - regional LoRaWAN
const IDENTITY_SERVER = {
  label: "EU1 (Global Identity Server)",
  baseUrl: "https://eu1.cloud.thethings.network",
  host: "eu1.cloud.thethings.network",
  purpose: "Auth, Applications, Devices, Organizations",
};

const DATA_PLANES = {
  label: "NAM1 (North America Data Planes)",
  baseUrl: "https://nam1.cloud.thethings.network",
  host: "nam1.cloud.thethings.network",
  consoleUrl: "https://nam1.cloud.thethings.network/console",
  frequencyPlan: "US_902_928_FSB_2",
  purpose: "Network Server, Application Server, Join Server",
};

export function TTNDiagnosticsPanel({ data, className }: TTNDiagnosticsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isProvisioned = data.provisioning_status === "ready";
  const lastHttpOk = data.last_http_status && data.last_http_status >= 200 && data.last_http_status < 300;

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
          {/* Identity Server Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4 text-primary" />
              <span>Identity Server (Global Registry)</span>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                EU1 ✓
              </Badge>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm pl-6">
              <span className="text-muted-foreground">Host:</span>
              <code className="text-xs font-mono text-foreground/80">
                {IDENTITY_SERVER.host}
              </code>
              <span className="text-muted-foreground">Purpose:</span>
              <span className="text-xs text-foreground/80">
                {IDENTITY_SERVER.purpose}
              </span>
            </div>
          </div>

          {/* Data Planes Info */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Server className="h-4 w-4 text-safe" />
              <span>Data Planes (Regional LoRaWAN)</span>
              <Badge variant="outline" className="bg-safe/10 text-safe border-safe/30 text-xs">
                NAM1 ✓
              </Badge>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm pl-6">
              <span className="text-muted-foreground">Host:</span>
              <code className="text-xs font-mono text-foreground/80">
                {DATA_PLANES.host}
              </code>
              <span className="text-muted-foreground">Purpose:</span>
              <span className="text-xs text-foreground/80">
                {DATA_PLANES.purpose}
              </span>
              <span className="text-muted-foreground">Frequency:</span>
              <code className="text-xs font-mono text-foreground/80">
                {DATA_PLANES.frequencyPlan}
              </code>
            </div>
          </div>

          {/* Application Info */}
          {data.ttn_application_id && (
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm border-t pt-3">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Application:
              </span>
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

          {/* Provisioning Proof Report */}
          {data.proof_report && (
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {data.proof_report.cli_equivalence ? (
                  <CheckCircle2 className="h-4 w-4 text-safe" />
                ) : (
                  <XCircle className="h-4 w-4 text-alarm" />
                )}
                <span>Provisioning Proof</span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    data.proof_report.cli_equivalence 
                      ? "bg-safe/10 text-safe border-safe/30"
                      : "bg-alarm/10 text-alarm border-alarm/30"
                  )}
                >
                  CLI Equiv: {data.proof_report.cli_equivalence ? "YES" : "NO"}
                </Badge>
              </div>
              
              <div className="text-xs space-y-1 pl-6">
                <p className="text-muted-foreground">
                  Verified at: {new Date(data.proof_report.timestamp).toLocaleString()}
                </p>
                
                {/* Step-by-step verification */}
                <div className="space-y-0.5 mt-2">
                  {data.proof_report.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {step.match ? (
                        <CheckCircle2 className="h-3 w-3 text-safe" />
                      ) : (
                        <XCircle className="h-3 w-3 text-alarm" />
                      )}
                      <span className="font-mono">{step.step}</span>
                      <span className="text-muted-foreground">→</span>
                      <code className={cn(
                        "text-xs",
                        step.match ? "text-safe" : "text-alarm"
                      )}>
                        {step.host}
                      </code>
                      {step.status && (
                        <span className="text-muted-foreground">({step.status})</span>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Webhook verification */}
                {data.proof_report.webhook_verification && (
                  <div className="mt-2 pt-2 border-t border-dashed">
                    <p className="text-muted-foreground">Webhook Verification:</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={data.proof_report.webhook_verification.base_url_match ? "text-safe" : "text-alarm"}>
                        URL: {data.proof_report.webhook_verification.base_url_match ? "✓" : "✗"}
                      </span>
                      <span className={data.proof_report.webhook_verification.secret_configured ? "text-safe" : "text-alarm"}>
                        Secret: {data.proof_report.webhook_verification.secret_configured ? "✓" : "✗"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Console Link */}
          <div className="pt-2 border-t">
            <a
              href={`${DATA_PLANES.consoleUrl}/applications/${data.ttn_application_id || ""}`}
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
