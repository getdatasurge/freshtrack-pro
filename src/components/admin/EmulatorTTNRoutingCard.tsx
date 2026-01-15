/**
 * Emulator TTN Routing Card
 * Shows TTN routing status and controls for the sensor simulator
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Radio,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Loader2,
  Settings2,
  RefreshCw,
  Zap,
  Route,
} from "lucide-react";
import { TTNSetupWizard } from "./TTNSetupWizard";
import { cn } from "@/lib/utils";
import { useTTNConfig } from "@/contexts/TTNConfigContext";
import { TTNConfigSourceBadge } from "@/components/ttn/TTNConfigSourceBadge";
import { TTNGuardDisplay } from "@/components/ttn/TTNGuardDisplay";
import { checkTTNOperationAllowed } from "@/lib/ttn/guards";

interface EmulatorTTNRoutingCardProps {
  organizationId: string | null;
  selectedUnitId: string | null;
  emulatorDevEui?: string;
  isConfigured?: boolean;
  onRoutingModeChange?: (viaTTN: boolean) => void;
}

interface TTNConnectionStatus {
  isEnabled: boolean;
  hasApiKey: boolean;
  region: string;
  applicationId: string | null;
  lastTestSuccess: boolean | null;
  lastTestAt: string | null;
  lastTestError: string | null;
}

export function EmulatorTTNRoutingCard({
  organizationId,
  selectedUnitId,
  emulatorDevEui,
  onRoutingModeChange,
}: EmulatorTTNRoutingCardProps) {
  const [status, setStatus] = useState<TTNConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [routeViaTTN, setRouteViaTTN] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  
  // TTN Config Context for state awareness
  const { context: ttnContext } = useTTNConfig();
  const guardResult = checkTTNOperationAllowed('simulate', ttnContext);

  const loadStatus = useCallback(async () => {
    if (!organizationId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-ttn-settings", {
        body: { action: "get", organization_id: organizationId },
      });

      if (error) throw error;

      const lastTest = data.last_connection_test_result as { success?: boolean; error?: string } | null;

      setStatus({
        isEnabled: data.is_enabled || false,
        hasApiKey: data.has_api_key || false,
        region: data.ttn_region || "nam1",
        applicationId: data.global_application_id || null,
        lastTestSuccess: lastTest?.success ?? null,
        lastTestAt: data.last_connection_test_at || null,
        lastTestError: lastTest?.error || null,
      });
    } catch (err) {
      console.error("[EmulatorTTNRoutingCard] Error loading status:", err);
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleTestConnection = async () => {
    if (!organizationId) return;

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-ttn-settings", {
        body: { action: "test", organization_id: organizationId },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("TTN connection verified!");
      } else {
        toast.error(data.error || "Connection test failed");
      }

      await loadStatus();
    } catch (err) {
      console.error("[EmulatorTTNRoutingCard] Test error:", err);
      toast.error("Failed to test connection");
    } finally {
      setIsTesting(false);
    }
  };

  const handleRoutingToggle = (enabled: boolean) => {
    if (enabled && !status?.isEnabled) {
      // Need to complete wizard first
      setShowWizard(true);
      return;
    }

    setRouteViaTTN(enabled);
    onRoutingModeChange?.(enabled);

    if (enabled) {
      toast.info("TTN routing enabled - uplinks will flow through The Things Network");
    } else {
      toast.info("Direct injection mode - uplinks bypass TTN");
    }
  };

  const handleCopyDevEui = () => {
    if (emulatorDevEui) {
      navigator.clipboard.writeText(emulatorDevEui);
      toast.success("DevEUI copied to clipboard");
    }
  };

  const isReady = status?.isEnabled && status?.hasApiKey && status?.lastTestSuccess;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Route className="w-4 h-4 text-primary" />
              TTN Routing
            </CardTitle>
            <TTNConfigSourceBadge context={ttnContext} size="sm" />
          </div>
          <CardDescription className="text-xs">
            Route emulator data through The Things Network for end-to-end testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Guard Display - Show blockers when TTN routing enabled but config not ready */}
          {routeViaTTN && !guardResult.allowed && (
            <TTNGuardDisplay result={guardResult} showWarnings />
          )}
          
          {/* Routing Mode Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              {routeViaTTN ? (
                <Radio className="w-5 h-5 text-green-500" />
              ) : (
                <Zap className="w-5 h-5 text-primary" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {routeViaTTN ? "Route Through TTN" : "Direct Injection"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {routeViaTTN 
                    ? "Uplinks flow through TTN webhook" 
                    : "Data injected directly to database"}
                </p>
              </div>
            </div>
            <Switch
              checked={routeViaTTN}
              onCheckedChange={handleRoutingToggle}
              disabled={isLoading}
            />
          </div>

          {/* Status Display */}
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : status ? (
            <div className="space-y-3">
              {/* Connection Status */}
              <div className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                isReady 
                  ? "bg-green-500/5 border-green-500/20" 
                  : status.isEnabled
                    ? "bg-amber-500/5 border-amber-500/20"
                    : "bg-muted/50"
              )}>
                <div className="flex items-center gap-2">
                  {isReady ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : status.isEnabled ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">
                    {isReady 
                      ? "Connected" 
                      : status.isEnabled 
                        ? "Configuration Incomplete" 
                        : "Not Configured"}
                  </span>
                </div>
                <Badge variant={isReady ? "default" : "secondary"} className="text-xs">
                  {status.region.toUpperCase()}
                </Badge>
              </div>

              {/* Last Test Result */}
              {status.lastTestAt && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>Last tested:</span>
                  <span>{new Date(status.lastTestAt).toLocaleString()}</span>
                  {status.lastTestSuccess === false && status.lastTestError && (
                    <Badge variant="destructive" className="text-xs">
                      {status.lastTestError.slice(0, 30)}...
                    </Badge>
                  )}
                </div>
              )}

              {/* DevEUI Display */}
              {emulatorDevEui && routeViaTTN && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Emulator DevEUI</Label>
                      <Button variant="ghost" size="sm" onClick={handleCopyDevEui} className="h-6 px-2">
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <code className="block text-xs font-mono p-2 rounded bg-muted border text-center">
                      {emulatorDevEui.match(/.{1,2}/g)?.join(':').toUpperCase() || emulatorDevEui}
                    </code>
                    <p className="text-xs text-amber-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Must be registered in TTN for uplinks to work
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Unable to load TTN status
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWizard(true)}
              className="flex-1"
            >
              <Settings2 className="w-4 h-4 mr-1" />
              Setup
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting || !status?.hasApiKey}
              className="flex-1"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Test
            </Button>
          </div>
        </CardContent>
      </Card>

      <TTNSetupWizard
        organizationId={organizationId}
        open={showWizard}
        onOpenChange={setShowWizard}
        emulatorDevEui={emulatorDevEui}
        onComplete={() => {
          loadStatus();
          if (routeViaTTN) {
            onRoutingModeChange?.(true);
          }
        }}
      />
    </>
  );
}
