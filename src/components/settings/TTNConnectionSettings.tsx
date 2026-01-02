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

interface TTNTestResult {
  success: boolean;
  error?: string;
  hint?: string;
  applicationName?: string;
  statusCode?: number;
  testedAt?: string;
  clusterTested?: string;
  effectiveApplicationId?: string;
  apiKeyLast4?: string;
  request_id?: string;
  // Legacy field for backwards compatibility
  message?: string;
}

interface BootstrapResult {
  ok: boolean;
  request_id: string;
  action: string;
  permissions?: {
    valid: boolean;
    rights: string[];
    missing_core: string[];
    missing_webhook: string[];
    can_configure_webhook: boolean;
    can_manage_devices: boolean;
  };
  webhook?: {
    webhook_id: string;
    base_url: string;
    format: string;
    events_enabled: string[];
    secret_configured: boolean;
  };
  webhook_action?: "created" | "updated" | "unchanged";
  error?: {
    code: string;
    message: string;
    hint: string;
    missing_permissions?: string[];
  };
  config?: {
    api_key_last4: string;
    webhook_secret_last4: string;
    webhook_url: string;
    application_id: string;
    cluster: string;
    updated_at: string;
  };
}

interface WebhookVerifyResult {
  success: boolean;
  status: "in_sync" | "out_of_sync" | "not_found" | "not_configured" | "auth_error" | "error" | "network_error";
  message: string;
  hint?: string;
  differences?: string[];
  ttn_config?: {
    webhook_id: string;
    base_url: string;
    format: string;
    has_secret_header: boolean;
    uplink_message_enabled: boolean;
    join_accept_enabled: boolean;
  };
  expected_config?: {
    webhook_id: string;
    base_url: string;
    format: string;
    has_secret_header: boolean;
    uplink_message_enabled: boolean;
    join_accept_enabled: boolean;
  };
}

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
  api_key_updated_at: string | null;
  has_webhook_secret: boolean;
  webhook_secret_last4: string | null;
  webhook_url: string | null;
  webhook_id: string | null;
  webhook_events: string[] | null;
  last_connection_test_at: string | null;
  last_connection_test_result: TTNTestResult | null;
  last_updated_source: string | null;
  last_test_source: string | null;
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
  const [newApiKey, setNewApiKey] = useState("");
  const [newApplicationId, setNewApplicationId] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<BootstrapResult | null>(null);
  const [isVerifyingWebhook, setIsVerifyingWebhook] = useState(false);
  const [webhookVerifyResult, setWebhookVerifyResult] = useState<WebhookVerifyResult | null>(null);

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
          api_key_updated_at: data.api_key_updated_at ?? null,
          has_webhook_secret: data.has_webhook_secret ?? false,
          webhook_secret_last4: data.webhook_secret_last4 ?? null,
          webhook_url: data.webhook_url ?? WEBHOOK_URL,
          webhook_id: data.webhook_id ?? null,
          webhook_events: data.webhook_events ?? null,
          last_connection_test_at: data.last_connection_test_at ?? null,
          last_connection_test_result: data.last_connection_test_result ?? null,
          last_updated_source: data.last_updated_source ?? null,
          last_test_source: data.last_test_source ?? null,
        });
        setRegion(data.ttn_region || "nam1");
        setIsEnabled(data.is_enabled ?? false);
        // Set application ID for the form
        if (data.ttn_application_id) {
          setNewApplicationId(data.ttn_application_id);
        }
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

  const handleVerifyWebhook = async () => {
    if (!organizationId) return;

    setIsVerifyingWebhook(true);
    setWebhookVerifyResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("ttn-provision-org", {
        body: {
          action: "verify_webhook",
          organization_id: organizationId,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      setWebhookVerifyResult(data as WebhookVerifyResult);

      if (data?.status === "in_sync") {
        toast.success("Webhook configuration is in sync with TTN");
      } else if (data?.status === "out_of_sync") {
        toast.warning("Webhook configuration differs from TTN", {
          description: data.differences?.[0] || "See details below",
        });
      } else if (data?.status === "not_found") {
        toast.error("Webhook not found in TTN", {
          description: data.hint,
        });
      } else if (data?.status === "auth_error") {
        toast.error(data.message, {
          description: data.hint,
        });
      } else {
        toast.error(data?.message || "Verification failed");
      }
    } catch (err: any) {
      console.error("Verify webhook error:", err);
      toast.error(err.message || "Failed to verify webhook");
    } finally {
      setIsVerifyingWebhook(false);
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

  const handleSaveApiKey = async () => {
    if (!organizationId || !newApiKey.trim()) return;

    // Require application ID for the bootstrap flow
    const effectiveAppId = newApplicationId.trim() || settings?.ttn_application_id;
    if (!effectiveAppId) {
      toast.error("Please enter the TTN Application ID");
      return;
    }

    setIsSavingApiKey(true);
    setBootstrapResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // Use the new ttn-bootstrap endpoint for automated webhook setup
      const { data, error } = await supabase.functions.invoke("ttn-bootstrap", {
        body: {
          action: "save_and_configure",
          organization_id: organizationId,
          cluster: region,
          application_id: effectiveAppId,
          api_key: newApiKey.trim(),
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      const result = data as BootstrapResult;
      setBootstrapResult(result);

      if (result.ok) {
        setNewApiKey("");
        const actionMsg = result.webhook_action === "created"
          ? "Webhook created in TTN"
          : result.webhook_action === "updated"
          ? "Webhook updated in TTN"
          : "Configuration saved";
        toast.success(`API key validated. ${actionMsg}!`);
        await loadSettings();
      } else {
        // Handle permission errors with detailed feedback
        if (result.error?.code === "TTN_PERMISSION_MISSING") {
          toast.error(result.error.message, {
            description: result.error.hint,
            duration: 8000,
          });
        } else if (result.error?.code === "WEBHOOK_SETUP_FAILED") {
          toast.error("Webhook setup failed", {
            description: result.error.hint,
            duration: 6000,
          });
        } else {
          toast.error(result.error?.message || "Configuration failed");
        }
      }
    } catch (err: any) {
      console.error("Save API key error:", err);
      toast.error(err.message || "Failed to save and configure TTN");
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const formatSourceLabel = (source: string | null) => {
    if (!source) return "Unknown";
    return source === "emulator" ? "Emulator" : "FrostGuard";
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

            {/* API Key & Webhook Configuration */}
            <div className="space-y-4 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium">TTN API Configuration</Label>
                  <InfoTooltip>Enter your TTN Application ID and API key. Webhook will be configured automatically.</InfoTooltip>
                </div>
                <Button variant="ghost" size="sm" onClick={loadSettings} disabled={isLoading}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {/* Current Configuration Status */}
              {settings?.has_api_key && (
                <div className="text-sm space-y-2 p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current key:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">****{settings.api_key_last4}</code>
                      {settings.last_updated_source && (
                        <Badge variant="outline" className="text-xs">
                          {formatSourceLabel(settings.last_updated_source)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {settings.api_key_updated_at && (
                    <p className="text-xs text-muted-foreground">
                      Updated: {new Date(settings.api_key_updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* Bootstrap Success Banner */}
              {bootstrapResult?.ok && bootstrapResult.webhook_action && (
                <div className="p-3 rounded-lg bg-safe/10 border border-safe/30">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-safe" />
                    <span className="text-sm font-medium text-safe">
                      {bootstrapResult.webhook_action === "created"
                        ? "Webhook created in TTN!"
                        : "Webhook updated in TTN!"}
                    </span>
                  </div>
                  {bootstrapResult.permissions && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Permissions validated: {bootstrapResult.permissions.rights?.length || 0} rights granted
                    </p>
                  )}
                </div>
              )}

              {/* Bootstrap Error Banner */}
              {bootstrapResult && !bootstrapResult.ok && bootstrapResult.error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-destructive">
                        {bootstrapResult.error.message}
                      </span>
                      {bootstrapResult.error.hint && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {bootstrapResult.error.hint}
                        </p>
                      )}
                      {bootstrapResult.error.missing_permissions && bootstrapResult.error.missing_permissions.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium">Missing permissions:</p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside mt-1">
                            {bootstrapResult.error.missing_permissions.map(p => (
                              <li key={p}>{p.replace("RIGHT_APPLICATION_", "").toLowerCase().replace(/_/g, " ")}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration Form */}
              <div className="space-y-3">
                {/* Cluster Selection */}
                <div className="space-y-1.5">
                  <Label className="text-sm">TTN Cluster</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select cluster" />
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

                {/* Application ID */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Application ID</Label>
                  <Input
                    placeholder="my-ttn-application-id"
                    value={newApplicationId}
                    onChange={(e) => setNewApplicationId(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Find this in TTN Console → Applications
                  </p>
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                  <Label className="text-sm">API Key</Label>
                  <Input
                    type="password"
                    placeholder="NNSXS.XXXXXXXXXX..."
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Create a key with: Read/Write application settings, Read/Write devices, Read uplinks
                  </p>
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSaveApiKey}
                  disabled={isSavingApiKey || !newApiKey.trim() || !newApplicationId.trim()}
                  className="w-full"
                >
                  {isSavingApiKey ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating & Configuring Webhook...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Save & Configure Webhook
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Webhook Configuration */}
            <div className="space-y-4 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-medium">Webhook Configuration</Label>
                </div>
                {settings.has_webhook_secret && (
                  <Badge variant="outline" className="bg-safe/10 text-safe border-safe/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                )}
              </div>

              {/* Webhook Status Summary */}
              {settings.has_webhook_secret && (
                <div className="grid gap-2 text-sm p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Webhook ID:</span>
                    <code className="bg-muted px-2 py-0.5 rounded text-xs">
                      {settings.webhook_id || "freshtracker"}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Secret:</span>
                    <code className="bg-muted px-2 py-0.5 rounded text-xs">
                      ****{settings.webhook_secret_last4 || "****"}
                    </code>
                  </div>
                  {settings.webhook_events && settings.webhook_events.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Events:</span>
                      <div className="flex gap-1">
                        {settings.webhook_events.map(event => (
                          <Badge key={event} variant="secondary" className="text-xs">
                            {event.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                    value={settings.webhook_url || WEBHOOK_URL}
                    readOnly
                    className="font-mono text-xs bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(settings.webhook_url || WEBHOOK_URL, "Webhook URL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Regenerate Webhook Secret */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="text-sm font-medium">Regenerate Webhook Secret</p>
                  <p className="text-xs text-muted-foreground">
                    Updates the secret in both FrostGuard and TTN
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateWebhookSecret}
                  disabled={isRegenerating || !settings.has_webhook_secret}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
                  Regenerate
                </Button>
              </div>

              {/* Verify Webhook Sync */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="text-sm font-medium">Verify Webhook Sync</p>
                  <p className="text-xs text-muted-foreground">
                    Check if TTN webhook matches FrostGuard configuration
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyWebhook}
                  disabled={isVerifyingWebhook || !settings.has_webhook_secret}
                >
                  {isVerifyingWebhook ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Verify
                </Button>
              </div>

              {/* Webhook Verification Result */}
              {webhookVerifyResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  webhookVerifyResult.status === "in_sync"
                    ? "bg-safe/10 border border-safe/30"
                    : webhookVerifyResult.status === "out_of_sync"
                    ? "bg-warning/10 border border-warning/30"
                    : "bg-destructive/10 border border-destructive/30"
                }`}>
                  <div className="flex items-start gap-2">
                    {webhookVerifyResult.status === "in_sync" ? (
                      <CheckCircle className="h-4 w-4 text-safe mt-0.5 flex-shrink-0" />
                    ) : webhookVerifyResult.status === "out_of_sync" ? (
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 space-y-2">
                      <span className={`font-medium ${
                        webhookVerifyResult.status === "in_sync"
                          ? "text-safe"
                          : webhookVerifyResult.status === "out_of_sync"
                          ? "text-warning"
                          : "text-destructive"
                      }`}>
                        {webhookVerifyResult.message}
                      </span>
                      {webhookVerifyResult.hint && (
                        <p className="text-xs text-muted-foreground">{webhookVerifyResult.hint}</p>
                      )}
                      {webhookVerifyResult.differences && webhookVerifyResult.differences.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium mb-1">Differences:</p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                            {webhookVerifyResult.differences.map((diff, i) => (
                              <li key={i}>{diff}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                  <div className="flex items-start gap-2">
                    {settings.last_connection_test_result.success ? (
                      <CheckCircle className="h-4 w-4 text-safe mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 space-y-1">
                      {/* Show success message or error */}
                      <span className="font-medium">
                        {settings.last_connection_test_result.success 
                          ? (settings.last_connection_test_result.applicationName 
                              ? `Connected to ${settings.last_connection_test_result.applicationName}`
                              : "Connection successful")
                          : (settings.last_connection_test_result.error || settings.last_connection_test_result.message || "Connection failed")}
                      </span>
                      
                      {/* Show hint for failures */}
                      {!settings.last_connection_test_result.success && settings.last_connection_test_result.hint && (
                        <p className="text-xs text-muted-foreground">
                          {settings.last_connection_test_result.hint}
                        </p>
                      )}
                      
                      {/* Show cluster tested */}
                      {settings.last_connection_test_result.clusterTested && (
                        <p className="text-xs text-muted-foreground">
                          Cluster: {settings.last_connection_test_result.clusterTested}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-current/10">
                    {settings.last_connection_test_at && (
                      <p className="text-xs text-muted-foreground">
                        Tested: {new Date(settings.last_connection_test_at).toLocaleString()}
                      </p>
                    )}
                    {/* Copy diagnostics button for failures */}
                    {!settings.last_connection_test_result.success && settings.last_connection_test_result.request_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          const diagnostics = JSON.stringify({
                            request_id: settings.last_connection_test_result?.request_id,
                            error: settings.last_connection_test_result?.error,
                            hint: settings.last_connection_test_result?.hint,
                            statusCode: settings.last_connection_test_result?.statusCode,
                            cluster: settings.last_connection_test_result?.clusterTested,
                            testedAt: settings.last_connection_test_result?.testedAt,
                          }, null, 2);
                          navigator.clipboard.writeText(diagnostics);
                          toast.success("Diagnostics copied to clipboard");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Diagnostics
                      </Button>
                    )}
                  </div>
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
