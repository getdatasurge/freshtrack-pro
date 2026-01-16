/**
 * SupportDiagnosticsPanel
 * 
 * A small diagnostic panel visible only to Super Admins in support mode.
 * Shows real vs effective identity to help debug impersonation issues.
 * Prevents "silent empty" scenarios where data appears missing but is actually a scoping issue.
 */

import { useState } from "react";
import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";
import { useSuperAdmin } from "@/contexts/SuperAdminContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  ChevronUp, 
  Bug,
  User,
  Building2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SupportDiagnosticsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isSuperAdmin, isSupportModeActive } = useSuperAdmin();
  const {
    effectiveUserId,
    effectiveOrgId,
    effectiveOrgName,
    effectiveUserEmail,
    realUserId,
    realOrgId,
    isImpersonating,
    isLoading,
    isInitialized,
    impersonationChecked,
    refresh,
  } = useEffectiveIdentity();

  // Only show for Super Admins in support mode
  if (!isSuperAdmin || !isSupportModeActive) {
    return null;
  }

  const truncateId = (id: string | null) => {
    if (!id) return "null";
    return `${id.slice(0, 8)}...`;
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className={cn(
        "bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg",
        "transition-all duration-200 ease-in-out",
        isExpanded ? "w-80" : "w-auto"
      )}>
        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between gap-2 p-2 text-xs"
        >
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-warning" />
            <span className="font-medium">Support Diagnostics</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </Button>

        {/* Expanded Panel */}
        {isExpanded && (
          <div className="p-3 pt-0 space-y-3 text-xs">
            {/* Status Badges */}
            <div className="flex flex-wrap gap-1">
              <Badge 
                variant={isImpersonating ? "default" : "outline"}
                className="text-xs"
              >
                {isImpersonating ? (
                  <><Eye className="w-3 h-3 mr-1" /> Impersonating</>
                ) : (
                  <><EyeOff className="w-3 h-3 mr-1" /> Not Impersonating</>
                )}
              </Badge>
              <Badge 
                variant={isInitialized ? "outline" : "destructive"}
                className="text-xs"
              >
                {isInitialized ? "Initialized" : "Loading..."}
              </Badge>
            </div>

            {/* Identity Info */}
            <div className="space-y-2 font-mono">
              {/* Real Identity */}
              <div className="p-2 rounded bg-muted/50">
                <div className="font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> Real Identity
                </div>
                <div className="space-y-0.5">
                  <div>User: {truncateId(realUserId)}</div>
                  <div>Org: {truncateId(realOrgId)}</div>
                </div>
              </div>

              {/* Effective Identity */}
              <div className={cn(
                "p-2 rounded",
                isImpersonating ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
              )}>
                <div className="font-semibold text-foreground mb-1 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Effective Identity
                </div>
                <div className="space-y-0.5">
                  <div>User: {truncateId(effectiveUserId)}</div>
                  <div>Org: {truncateId(effectiveOrgId)}</div>
                  {effectiveOrgName && (
                    <div className="text-muted-foreground truncate">
                      Name: {effectiveOrgName}
                    </div>
                  )}
                  {effectiveUserEmail && (
                    <div className="text-muted-foreground truncate">
                      Email: {effectiveUserEmail}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* State Flags */}
            <div className="grid grid-cols-2 gap-1 text-muted-foreground">
              <div>isLoading: {isLoading ? "true" : "false"}</div>
              <div>isInitialized: {isInitialized ? "true" : "false"}</div>
              <div>impChecked: {impersonationChecked ? "true" : "false"}</div>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              className="w-full text-xs"
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-3 h-3 mr-1", isLoading && "animate-spin")} />
              Refresh Identity
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
