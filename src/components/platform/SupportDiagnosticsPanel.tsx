/**
 * SupportDiagnosticsPanel
 * 
 * A small diagnostic panel visible only to Super Admins in support mode.
 * Shows real vs effective identity to help debug impersonation issues.
 * Prevents "silent empty" scenarios where data appears missing but is actually a scoping issue.
 */

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";
import { useSuperAdmin } from "@/contexts/SuperAdminContext";
import { getOrgCacheStats, clearAllOrgScopedCaches } from "@/lib/orgScopedInvalidation";
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
  Database,
  Trash2,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
    impersonationSessionId,
    refresh,
  } = useEffectiveIdentity();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [cacheStats, setCacheStats] = useState<{ totalCached: number; byKey: Record<string, number> }>({ totalCached: 0, byKey: {} });

  // Only show for Super Admins in support mode
  if (!isSuperAdmin || !isSupportModeActive) {
    return null;
  }

  // Update cache stats periodically
  useEffect(() => {
    const updateStats = () => {
      setCacheStats(getOrgCacheStats(queryClient));
    };
    
    updateStats();
    const interval = setInterval(updateStats, 2000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const truncateId = (id: string | null) => {
    if (!id) return "null";
    return `${id.slice(0, 8)}...`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  const handleClearCaches = async () => {
    await clearAllOrgScopedCaches(queryClient);
    setCacheStats(getOrgCacheStats(queryClient));
    toast({
      title: "Caches Cleared",
      description: "All org-scoped caches have been cleared.",
    });
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
            {isImpersonating && (
              <Badge variant="default" className="text-[10px] px-1 py-0">
                IMPERSONATING
              </Badge>
            )}
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
                  <div className="flex items-center justify-between">
                    <span>User: {truncateId(realUserId)}</span>
                    {realUserId && (
                      <Copy 
                        className="w-3 h-3 cursor-pointer hover:text-primary" 
                        onClick={() => copyToClipboard(realUserId, "User ID")}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Org: {truncateId(realOrgId)}</span>
                    {realOrgId && (
                      <Copy 
                        className="w-3 h-3 cursor-pointer hover:text-primary" 
                        onClick={() => copyToClipboard(realOrgId, "Org ID")}
                      />
                    )}
                  </div>
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
                  <div className="flex items-center justify-between">
                    <span>User: {truncateId(effectiveUserId)}</span>
                    {effectiveUserId && (
                      <Copy 
                        className="w-3 h-3 cursor-pointer hover:text-primary" 
                        onClick={() => copyToClipboard(effectiveUserId, "User ID")}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Org: {truncateId(effectiveOrgId)}</span>
                    {effectiveOrgId && (
                      <Copy 
                        className="w-3 h-3 cursor-pointer hover:text-primary" 
                        onClick={() => copyToClipboard(effectiveOrgId, "Org ID")}
                      />
                    )}
                  </div>
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
              
              {/* Session Info */}
              {impersonationSessionId && (
                <div className="p-2 rounded bg-muted/50">
                  <div className="font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                    <Database className="w-3 h-3" /> Session
                  </div>
                  <div className="flex items-center justify-between">
                    <span>ID: {truncateId(impersonationSessionId)}</span>
                    <Copy 
                      className="w-3 h-3 cursor-pointer hover:text-primary" 
                      onClick={() => copyToClipboard(impersonationSessionId, "Session ID")}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Cache Stats */}
            <div className="p-2 rounded bg-muted/50">
              <div className="font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3" /> Cache Stats
                </span>
                <span className="text-xs font-normal">{cacheStats.totalCached} queries</span>
              </div>
              {Object.keys(cacheStats.byKey).length > 0 ? (
                <div className="grid grid-cols-2 gap-1 text-muted-foreground font-mono text-[10px]">
                  {Object.entries(cacheStats.byKey).slice(0, 6).map(([key, count]) => (
                    <div key={key}>{key}: {count}</div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-[10px]">No cached queries</div>
              )}
            </div>

            {/* State Flags */}
            <div className="grid grid-cols-2 gap-1 text-muted-foreground">
              <div>isLoading: {isLoading ? "true" : "false"}</div>
              <div>isInitialized: {isInitialized ? "true" : "false"}</div>
              <div>impChecked: {impersonationChecked ? "true" : "false"}</div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refresh()}
                className="flex-1 text-xs"
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-3 h-3 mr-1", isLoading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCaches}
                className="flex-1 text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear Caches
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
