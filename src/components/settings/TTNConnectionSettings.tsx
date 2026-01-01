import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Radio, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Copy, 
  Globe,
  Plus,
  AlertTriangle,
  Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";

interface TTNSettings {
  exists: boolean;
  is_enabled: boolean;
  ttn_region: string | null;
  ttn_application_id: string | null;
  provisioning_status: 'not_started' | 'provisioning' | 'completed' | 'failed';
  provisioning_error: string | null;
  provisioned_at: string | null;
  has_api_key: boolean;
  api_key_last4: string | null;
  has_webhook_secret: boolean;
  webhook_url: string | null;
  last_connection_test_at: string | null;
  last_connection_test_result: {
    success: boolean;
    message: string;
    error?: string;
    tested_at?: string;
  } | null;
}

interface TTNConnectionSettingsProps {
  organizationId: string | null;
}

const TTN_REGIONS = [
  { value: "nam1", label: "North America (nam1)" },
  { value: "eu1", label: "Europe (eu1)" },
  { value: "au1", label: "Australia (au1)" },
];

const WEBHOOK_URL = `https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/ttn-webhook`;

const InfoTooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-sm">{children}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export function TTNConnectionSettings({ organizationId }: TTNConnectionSettingsProps) {
  const [settings, setSettings] = useState<TTNSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [region, setRegion] = useState("nam1");
  const [isEnabled, setIsEnabled] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Session expired. Please log in again.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("manage-ttn-settings", {
        body: { action: "get", organization_id: organizationId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      if (data) {
        setSettings({
          exists: data.exists ?? false,
          is_enabled: data.is_enabled ?? false,
          ttn_region: data.ttn_region ?? null,
          ttn_application_id: data.ttn_application_id ?? null,
          provisioning_status: data.provisioning_status ?? 'not_started',
          provisioning_error: data.provisioning_error ?? null,
          provisioned_at: data.ttn_application_provisioned_at ?? null,
          has_api_key: data.has_api_key ?? false,
          api_key_last4: data.api_key_last4 ?? null,
          has_webhook_secret: data.has_webhook_secret ?? false,
          webhook_url: WEBHOOK_URL,
          last_connection_test_at: data.last_connection_test_at ?? null,
          last_connection_test_result: data.last_connection_test_result ?? null,
        });
        setRegion(data.ttn_region || "nam1");
        setIsEnabled(data.is_enabled ?? false);
      }
    } catch (err) {
      console.error("Error loading TTN settings:", err);
      toast.error("Failed to load TTN settings");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleProvision = async () => {
    if (!organizationId) return;

    setIsProvisioning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Session expired. Please log in again.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("ttn-provision-org", {
        body: {
          action: "provision",
          organization_id: organizationId,
          ttn_region: region,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("TTN Application provisioned successfully!");
        await loadSettings();
      } else {
        // Show more helpful error messages
        const errorMsg = data?.error || "Provisioning failed";
        const hint = data?.hint || "";

        if (errorMsg.includes("TTN admin credentials not configured")) {
          toast.error("TTN credentials not configured. Please contact your administrator to set up TTN_ADMIN_API_KEY and TTN_USER_ID in Supabase secrets.");
        } else {
          toast.error(hint ? `${errorMsg}: ${hint}` : errorMsg);
        }
      }
    } catch (err: any) {
      console.error("Provisioning error:", err);

      // Check for specific error messages
      if (err.message?.includes("TTN admin credentials")) {
        toast.error("TTN credentials not configured. Please contact your administrator.");
      } else {
        toast.error(err.message || "Failed to provision TTN application");
      }
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleRegenerateWebhookSecret = async () => {
    if (!organizationId) return;
    
    setIsRegenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("ttn-provision-org", {
        body: { 
          action: "regenerate_webhook_secret", 
          organization_id: organizationId,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Webhook secret regenerated and updated in TTN");
        await loadSettings();
      } else {
        toast.error(data?.error || "Failed to regenerate webhook secret");
      }
    } catch (err: any) {
      console.error("Regenerate error:", err);
      toast.error(err.message || "Failed to regenerate webhook secret");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleTest = async () => {
    if (!organizationId) return;
    
    setIsTesting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("manage-ttn-settings", {
        body: { 
          action: "test", 
          organization_id: organizationId,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      // The test action returns success directly, not nested under test_result
      if (data?.success) {
        toast.success("Connection successful!");
      } else {
        toast.error(data?.error || data?.message || "Connection test failed");
      }
      await loadSettings();
    } catch (err: any) {
      console.error("Test error:", err);
      toast.error(err.message || "Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    if (!organizationId) return;
    
    setIsSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("manage-ttn-settings", {
        body: { 
          action: "update", 
          organization_id: organizationId, 
          is_enabled: enabled 
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      setIsEnabled(enabled);
      toast.success(enabled ? "TTN integration enabled" : "TTN integration disabled");
    } catch (err: any) {
      console.error("Toggle error:", err);
      toast.error(err.message || "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (!organizationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            TTN Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No organization selected.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            TTN Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isProvisioned = settings?.provisioning_status === 'completed';
  const isFailed = settings?.provisioning_status === 'failed';
  const isProvisioningStatus = settings?.provisioning_status === 'provisioning';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5" />
          TTN Connection
        </CardTitle>
        <CardDescription>
          Connect your LoRaWAN sensors via The Things Network
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provisioning In Progress State */}
        {isProvisioningStatus && (
          <div className="p-6 rounded-lg border-2 border-primary/30 bg-primary/5">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
              <div>
                <h3 className="font-medium">Provisioning TTN Application...</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Creating your dedicated TTN application. This may take a moment.
                </p>
              </div>
              <Button onClick={loadSettings} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Status
              </Button>
            </div>
          </div>
        )}

        {/* Not Provisioned State */}
        {!isProvisioned && !isFailed && !isProvisioningStatus && (
          <div className="p-6 rounded-lg border-2 border-dashed border-muted-foreground/30">
            <div className="text-center space-y-4">
              <Radio className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <div>
                <h3 className="font-medium">TTN Application Not Provisioned</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a dedicated TTN application for your organization to receive sensor data
                </p>
              </div>
              
              {/* Region Selection */}
              <div className="max-w-xs mx-auto space-y-2">
                <Label className="text-sm">Select TTN Region</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {TTN_REGIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={handleProvision} disabled={isProvisioning} size="lg">
                {isProvisioning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Provision TTN Application
              </Button>
            </div>
          </div>
        )}

        {/* Failed State */}
        {isFailed && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="font-medium text-destructive">Provisioning Failed</p>
                <p className="text-sm text-muted-foreground">{settings?.provisioning_error}</p>
                <Button onClick={handleProvision} variant="outline" size="sm" disabled={isProvisioning}>
                  {isProvisioning ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Retry Provisioning
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Provisioned State */}
        {isProvisioned && (
          <>
            {/* Status Banner */}
            <div className="p-4 rounded-lg bg-safe/10 border border-safe/30">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-safe mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-safe">TTN Application Ready</p>
                  <div className="grid gap-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Application ID:</span>
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">{settings.ttn_application_id}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Region:</span>
                      <span>{TTN_REGIONS.find(r => r.value === settings.ttn_region)?.label || settings.ttn_region}</span>
                    </div>
                    {settings.provisioned_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Provisioned:</span>
                        <span>{new Date(settings.provisioned_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-0.5">
                <Label>Integration Active</Label>
                <p className="text-sm text-muted-foreground">
                  {isEnabled ? "Receiving sensor data from TTN" : "Integration is disabled"}
                </p>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggleEnabled}
                disabled={isSaving}
              />
            </div>

            {/* Webhook Configuration */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label>Webhook Configuration</Label>
              </div>
              
              {/* Webhook URL */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Webhook URL</Label>
                  <InfoTooltip>
                    This URL is automatically configured in your TTN application webhook
                  </InfoTooltip>
                </div>
                <div className="flex gap-2">
                  <Input 
                    value={WEBHOOK_URL}
                    readOnly 
                    className="font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(WEBHOOK_URL, "Webhook URL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Webhook Secret */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Webhook Secret</Label>
                    <InfoTooltip>
                      Used to authenticate incoming webhooks from TTN
                    </InfoTooltip>
                  </div>
                  {settings.has_webhook_secret && (
                    <Badge variant="outline" className="font-mono">Configured</Badge>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRegenerateWebhookSecret}
                  disabled={isRegenerating}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
                  Regenerate Secret
                </Button>
                <p className="text-xs text-muted-foreground">
                  Regenerating will update the webhook in TTN automatically
                </p>
              </div>
            </div>

            {/* Connection Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <Label>Connection Test</Label>
              </div>
              
              {settings.last_connection_test_result && (
                <div className={`p-3 rounded-lg text-sm ${
                  settings.last_connection_test_result.success 
                    ? "bg-safe/10 border border-safe/30" 
                    : "bg-destructive/10 border border-destructive/30"
                }`}>
                  <div className="flex items-center gap-2">
                    {settings.last_connection_test_result.success ? (
                      <CheckCircle className="h-4 w-4 text-safe" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span>{settings.last_connection_test_result.message}</span>
                  </div>
                  {settings.last_connection_test_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last tested: {new Date(settings.last_connection_test_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              
              <Button 
                variant="outline" 
                onClick={handleTest} 
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
            </div>
          </>
        )}

        {/* Info about next steps */}
        {isProvisioned && !isEnabled && (
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-warning">Integration Disabled</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Enable the integration above to start receiving sensor data from your TTN devices.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
