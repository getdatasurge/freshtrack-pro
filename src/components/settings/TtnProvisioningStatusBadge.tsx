import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TtnProvisioningState } from "@/types/ttn";
import { TTN_PROVISIONING_STATE_CONFIG } from "@/lib/entityStatusConfig";
import { Search, CloudUpload, CloudOff, Loader2, AlertCircle, Stethoscope } from "lucide-react";

interface TtnProvisioningStatusBadgeProps {
  state: TtnProvisioningState;
  lastCheckAt?: string | null;
  lastError?: string | null;
}

export function TtnProvisioningStatusBadge({ 
  state, 
  lastCheckAt, 
  lastError 
}: TtnProvisioningStatusBadgeProps) {
  const config = TTN_PROVISIONING_STATE_CONFIG[state] || TTN_PROVISIONING_STATE_CONFIG.unknown;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={config.variant}
          className={cn("cursor-help", config.className)}
        >
          {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-3">
        <div className="space-y-1.5 text-sm">
          <p><span className="font-medium">Status:</span> {config.tooltip.meaning}</p>
          <p><span className="font-medium">System:</span> {config.tooltip.systemState}</p>
          {config.tooltip.userAction && (
            <p className="text-primary"><span className="font-medium">Action:</span> {config.tooltip.userAction}</p>
          )}
          {lastError && state === 'error' && (
            <p className="text-destructive text-xs mt-2 border-t pt-2">
              <span className="font-medium">Error:</span> {lastError.substring(0, 100)}
            </p>
          )}
          {lastCheckAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Last checked: {new Date(lastCheckAt).toLocaleString()}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface TtnActionsProps {
  state: TtnProvisioningState;
  isCheckingTtn: boolean;
  isProvisioning: boolean;
  onCheckTtn: () => void;
  onProvision: () => void;
  onUnprovision: () => void;
  canEdit: boolean;
  /** Whether TTN is configured NOW and sensor has DevEUI - allows check even if state is not_configured */
  canCheckNow?: boolean;
  /** Reason why check is not available (for tooltip) */
  checkUnavailableReason?: string;
  /** Diagnose TTN status across all planes */
  onDiagnose?: () => void;
  isDiagnosing?: boolean;
}

export function TtnActions({
  state,
  isCheckingTtn,
  isProvisioning,
  onCheckTtn,
  onProvision,
  onUnprovision,
  canEdit,
  canCheckNow = false,
  checkUnavailableReason,
  onDiagnose,
  isDiagnosing,
}: TtnActionsProps) {
  if (!canEdit) return null;

  // Not configured - show check button if TTN is now configured, otherwise show info icon
  if (state === "not_configured") {
    // If TTN is configured NOW and sensor has DevEUI, allow checking
    if (canCheckNow) {
      return (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 gap-1 text-muted-foreground border-muted-foreground/30"
                onClick={onCheckTtn}
                disabled={isCheckingTtn}
              >
                {isCheckingTtn ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                <span className="text-xs">Detect</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Check if device exists in TTN (stored state may be outdated)
            </TooltipContent>
          </Tooltip>
        </div>
      );
    }
    
    // TTN not configured or missing DevEUI - show info icon with reason
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent>
          {checkUnavailableReason || "Configure TTN and add DevEUI to enable provisioning"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* Check TTN button - always available except not_configured */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCheckTtn}
            disabled={isCheckingTtn}
          >
            {isCheckingTtn ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Check TTN Status</TooltipContent>
      </Tooltip>

      {/* Diagnose button - available for all states except not_configured */}
      {onDiagnose && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onDiagnose}
              disabled={isDiagnosing}
            >
              {isDiagnosing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Stethoscope className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Diagnose TTN Planes</TooltipContent>
        </Tooltip>
      )}

      {/* Provision button - only if missing_in_ttn */}
      {state === "missing_in_ttn" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 gap-1 text-primary border-primary/30 hover:bg-primary/10"
              onClick={onProvision}
              disabled={isProvisioning}
            >
              {isProvisioning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CloudUpload className="h-3.5 w-3.5" />
              )}
              <span className="text-xs">Provision</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Register device in TTN</TooltipContent>
        </Tooltip>
      )}

      {/* Unprovision button - only if exists_in_ttn */}
      {state === "exists_in_ttn" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onUnprovision}
            >
              <CloudOff className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove from TTN</TooltipContent>
        </Tooltip>
      )}

      {/* Unknown or error state - show check button prominently */}
      {(state === "unknown" || state === "error") && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 gap-1 text-muted-foreground border-muted-foreground/30"
              onClick={onCheckTtn}
              disabled={isCheckingTtn}
            >
              {isCheckingTtn ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              <span className="text-xs">Detect</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {state === "error" ? "Retry TTN check" : "Check if device exists in TTN"}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
