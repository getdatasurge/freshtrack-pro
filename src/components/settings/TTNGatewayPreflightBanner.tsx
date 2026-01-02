import React from "react";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Key,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { PreflightError } from "@/hooks/useGatewayProvisioningPreflight";

interface TTNGatewayPreflightBannerProps {
  status: "idle" | "checking" | "ready" | "blocked" | "error";
  keyType: "personal" | "organization" | "application" | "unknown" | null;
  ownerScope: "user" | "organization" | null;
  hasGatewayRights: boolean;
  missingRights: string[];
  error: PreflightError | null;
  onRunPreflight: () => void;
  isLoading: boolean;
  requestId?: string;
  ttnRegion?: string;
}

const KEY_TYPE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  personal: { label: "Personal API Key", variant: "default" },
  organization: { label: "Organization API Key", variant: "default" },
  application: { label: "Application API Key", variant: "destructive" },
  unknown: { label: "Unknown Key Type", variant: "secondary" },
};

export function TTNGatewayPreflightBanner({
  status,
  keyType,
  ownerScope,
  hasGatewayRights,
  missingRights,
  error,
  onRunPreflight,
  isLoading,
  requestId,
  ttnRegion = "nam1",
}: TTNGatewayPreflightBannerProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Don't render if idle
  if (status === "idle") {
    return null;
  }

  // Checking state
  if (status === "checking" || isLoading) {
    return (
      <div className="p-4 rounded-lg border border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          <div>
            <p className="font-medium text-sm">Checking gateway provisioning permissions...</p>
            <p className="text-xs text-muted-foreground">Validating TTN API key type and rights</p>
          </div>
        </div>
      </div>
    );
  }

  // Ready state - show success banner
  if (status === "ready" && hasGatewayRights) {
    return (
      <div className="p-4 rounded-lg border border-safe/30 bg-safe/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-safe" />
            <div>
              <p className="font-medium text-sm text-safe">Gateway provisioning ready</p>
              <div className="flex items-center gap-2 mt-1">
                {keyType && (
                  <Badge variant="outline" className="text-xs">
                    <Key className="h-3 w-3 mr-1" />
                    {KEY_TYPE_LABELS[keyType]?.label || keyType}
                  </Badge>
                )}
                {ownerScope && (
                  <Badge variant="outline" className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    {ownerScope === "user" ? "User Scope" : "Org Scope"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onRunPreflight} disabled={isLoading}>
            <Loader2 className={`h-3 w-3 mr-1 ${isLoading ? "animate-spin" : "hidden"}`} />
            Re-check
          </Button>
        </div>
      </div>
    );
  }

  // Error or blocked state
  const ttnConsoleUrl = `https://${ttnRegion}.cloud.thethings.network/console`;

  return (
    <div className="p-4 rounded-lg border border-warning/30 bg-warning/5">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {error?.code === "WRONG_KEY_TYPE" ? (
              <XCircle className="h-5 w-5 text-destructive mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-medium text-sm">
                {error?.message || "Gateway provisioning blocked"}
              </p>
              <p className="text-xs text-muted-foreground">{error?.hint}</p>
              
              {/* Key type badge */}
              {keyType && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge 
                    variant={KEY_TYPE_LABELS[keyType]?.variant || "secondary"} 
                    className="text-xs"
                  >
                    <Key className="h-3 w-3 mr-1" />
                    {KEY_TYPE_LABELS[keyType]?.label || keyType}
                  </Badge>
                  {missingRights.length > 0 && (
                    <Badge variant="outline" className="text-xs text-warning">
                      Missing: {missingRights.join(", ")}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="mt-4 space-y-4">
          {/* Fix steps */}
          {error?.fix_steps && error.fix_steps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">How to fix:</p>
              <ol className="text-sm space-y-1.5 ml-4">
                {error.fix_steps.map((step, index) => (
                  <li key={index} className="text-muted-foreground">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(ttnConsoleUrl, "_blank")}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open TTN Console
            </Button>
            <Button variant="ghost" size="sm" onClick={onRunPreflight} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : null}
              Re-check Permissions
            </Button>
          </div>

          {/* Request ID for debugging */}
          {requestId && (
            <p className="text-xs text-muted-foreground">
              Reference: {requestId}
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
