import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Radio,
  Save,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Key,
  Globe,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";

interface TTNSettings {
  exists: boolean;
  is_enabled: boolean;
  ttn_region: string | null;
  ttn_stack_base_url: string | null;
  ttn_identity_server_url: string | null;
  ttn_user_id: string | null;
  ttn_application_id: string | null;
  ttn_application_name: string | null;
  ttn_webhook_id: string | null;
  has_api_key: boolean;
  api_key_last4: string | null;
  api_key_updated_at: string | null;
  has_webhook_api_key: boolean;
  webhook_api_key_last4: string | null;
  last_connection_test_at: string | null;
  last_connection_test_result: {
    success: boolean;
    error?: string;
    hint?: string;
    message?: string;
    applications_count?: number;
    application_name?: string;
  } | null;
  using_global_defaults: boolean;
}

const TTN_REGIONS = [
  { value: "NAM1", label: "North America (nam1)" },
  { value: "EU1", label: "Europe (eu1)" },
  { value: "AU1", label: "Australia (au1)" },
  { value: "AS1", label: "Asia (as1)" },
];

const REGION_URLS: Record<string, { base: string; is: string }> = {
  NAM1: { base: "https://nam1.cloud.thethings.network", is: "https://eu1.cloud.thethings.network" },
  EU1: { base: "https://eu1.cloud.thethings.network", is: "https://eu1.cloud.thethings.network" },
  AU1: { base: "https://au1.cloud.thethings.network", is: "https://eu1.cloud.thethings.network" },
  AS1: { base: "https://as1.cloud.thethings.network", is: "https://eu1.cloud.thethings.network" },
};

interface TTNConnectionSettingsProps {
  organizationId: string | null;
}

export function TTNConnectionSettings({ organizationId }: TTNConnectionSettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [settings, setSettings] = useState<TTNSettings | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  
  // Form state
  const [isEnabled, setIsEnabled] = useState(false);
  const [region, setRegion] = useState("NAM1");
  const [baseUrl, setBaseUrl] = useState("");
  const [isUrl, setIsUrl] = useState("");
  const [userId, setUserId] = useState("");
  const [appId, setAppId] = useState("");
  const [appName, setAppName] = useState("");
  const [webhookId, setWebhookId] = useState("frostguard");
  const [apiKey, setApiKey] = useState("");
  const [webhookApiKey, setWebhookApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (organizationId) {
      loadSettings();
    } else {
      setIsLoading(false);
    }
  }, [organizationId]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // Check for active session before calling edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn("[TTNConnectionSettings] No active session, skipping TTN settings load");
        setHasSession(false);
        setIsLoading(false);
        return;
      }
      setHasSession(true);

      const { data, error } = await supabase.functions.invoke("manage-ttn-settings", {
        body: { action: "get" },
      });

      if (error) {
        // Handle 401 specifically
        if (error.message?.includes("401") || error.message?.includes("unauthorized")) {
          console.warn("[TTNConnectionSettings] Unauthorized - session may have expired");
          setHasSession(false);
          return;
        }
        throw error;
      }

      setSettings(data);
      setIsEnabled(data.is_enabled || false);
      setRegion(data.ttn_region || "NAM1");
      setBaseUrl(data.ttn_stack_base_url || REGION_URLS[data.ttn_region || "NAM1"]?.base || "");
      setIsUrl(data.ttn_identity_server_url || REGION_URLS[data.ttn_region || "NAM1"]?.is || "");
      setUserId(data.ttn_user_id || "");
      setAppId(data.ttn_application_id || "");
      setAppName(data.ttn_application_name || "");
      setWebhookId(data.ttn_webhook_id || "frostguard");
    } catch (error) {
      console.error("Failed to load TTN settings:", error);
      toast.error("Failed to load TTN settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    // Auto-populate URLs based on region
    const urls = REGION_URLS[newRegion];
    if (urls) {
      setBaseUrl(urls.base);
      setIsUrl(urls.is);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate session before calling edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setHasSession(false);
        toast.error("Your login session expired. Please sign out and sign in again.");
        return;
      }

      const updates: Record<string, unknown> = {
        is_enabled: isEnabled,
        ttn_region: region,
        ttn_stack_base_url: baseUrl,
        ttn_identity_server_url: isUrl,
        ttn_user_id: userId,
        ttn_application_id: appId || null,
        ttn_application_name: appName || null,
        ttn_webhook_id: webhookId,
      };

      // Only include API key if it was changed
      if (apiKey) {
        updates.ttn_api_key = apiKey;
      }
      if (webhookApiKey) {
        updates.ttn_webhook_api_key = webhookApiKey;
      }

      const { data, error } = await supabase.functions.invoke("manage-ttn-settings", {
        body: { action: "update", ...updates },
      });

      if (error) {
        // Handle specific error codes
        if (error.message?.includes("401")) {
          setHasSession(false);
          toast.error("Your login session expired. Please sign out and sign in again.");
          return;
        }
        if (error.message?.includes("403")) {
          toast.error("You need admin access to manage TTN settings.");
          return;
        }
        throw error;
      }

      toast.success("TTN settings saved");
      setApiKey(""); // Clear after save
      setWebhookApiKey("");
      await loadSettings(); // Reload to get updated state
    } catch (error) {
      console.error("Failed to save TTN settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      // Validate session before calling edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setHasSession(false);
        toast.error("Your login session expired. Please sign out and sign in again.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("manage-ttn-settings", {
        body: { action: "test" },
      });

      if (error) {
        if (error.message?.includes("401")) {
          setHasSession(false);
          toast.error("Your login session expired. Please sign out and sign in again.");
          return;
        }
        if (error.message?.includes("403")) {
          toast.error("You need admin access to test TTN connection.");
          return;
        }
        throw error;
      }

      if (data.success) {
        toast.success(data.message || "Connection successful!");
      } else {
        toast.error(data.error || "Connection test failed", {
          description: data.hint,
          duration: 8000,
        });
      }

      await loadSettings(); // Reload to show test result
    } catch (error) {
      console.error("Connection test failed:", error);
      toast.error("Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  // Show sign-in message if no organization or no session
  if (!organizationId || hasSession === false) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Radio className="h-8 w-8 text-muted-foreground/50" />
            <span>Please sign in to configure TTN settings</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading TTN settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const testResult = settings?.last_connection_test_result;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Radio className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>TTN Connection</CardTitle>
              <CardDescription>
                Configure The Things Network integration for LoRaWAN device management
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {settings?.using_global_defaults && (
              <Badge variant="outline" className="text-muted-foreground">
                Using Global Defaults
              </Badge>
            )}
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              aria-label="Enable TTN integration"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Connection Status */}
        {testResult && (
          <div className={`p-4 rounded-lg border ${
            testResult.success 
              ? "bg-safe/10 border-safe/30" 
              : "bg-destructive/10 border-destructive/30"
          }`}>
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle className="h-5 w-5 text-safe mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${testResult.success ? "text-safe" : "text-destructive"}`}>
                  {testResult.success ? "Connection Successful" : testResult.error || "Connection Failed"}
                </p>
                {testResult.hint && (
                  <p className="text-sm text-muted-foreground mt-1">{testResult.hint}</p>
                )}
                {testResult.applications_count !== undefined && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Found {testResult.applications_count} application(s)
                  </p>
                )}
                {settings?.last_connection_test_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last tested: {new Date(settings.last_connection_test_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Region Selection */}
          <div className="space-y-2">
            <Label htmlFor="ttn-region">TTN Region</Label>
            <Select value={region} onValueChange={handleRegionChange}>
              <SelectTrigger id="ttn-region">
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

          {/* User ID */}
          <div className="space-y-2">
            <Label htmlFor="ttn-user-id">TTN User ID</Label>
            <Input
              id="ttn-user-id"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="your-ttn-username"
            />
          </div>
        </div>

        {/* URLs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Label>Server URLs</Label>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ttn-base-url" className="text-sm text-muted-foreground">
                Regional Server (NS/AS/JS)
              </Label>
              <Input
                id="ttn-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://nam1.cloud.thethings.network"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ttn-is-url" className="text-sm text-muted-foreground">
                Identity Server (always eu1)
              </Label>
              <Input
                id="ttn-is-url"
                value={isUrl}
                onChange={(e) => setIsUrl(e.target.value)}
                placeholder="https://eu1.cloud.thethings.network"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Application Settings */}
        <div className="space-y-4">
          <Label>Application Settings (Optional)</Label>
          <p className="text-sm text-muted-foreground">
            Leave blank to auto-generate from organization slug
          </p>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ttn-app-id" className="text-sm text-muted-foreground">
                Application ID
              </Label>
              <Input
                id="ttn-app-id"
                value={appId}
                onChange={(e) => setAppId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="fg-your-org-slug"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ttn-app-name" className="text-sm text-muted-foreground">
                Application Name
              </Label>
              <Input
                id="ttn-app-name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="FrostGuard - Your Org"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* API Key */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <Label>API Authentication</Label>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ttn-api-key" className="text-sm">TTN API Key</Label>
                {settings?.has_api_key && (
                  <Badge variant="outline" className="text-xs">
                    Set (****{settings.api_key_last4})
                  </Badge>
                )}
              </div>
              <div className="relative">
                <Input
                  id="ttn-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={settings?.has_api_key ? "Enter new key to replace" : "NNSXS.xxxxx..."}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Generate an API key in TTN Console with at least "applications:read" and "applications:write:all" permissions
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ttn-webhook-key" className="text-sm">Webhook Secret (Optional)</Label>
                {settings?.has_webhook_api_key && (
                  <Badge variant="outline" className="text-xs">
                    Set (****{settings.webhook_api_key_last4})
                  </Badge>
                )}
              </div>
              <Input
                id="ttn-webhook-key"
                type="password"
                value={webhookApiKey}
                onChange={(e) => setWebhookApiKey(e.target.value)}
                placeholder={settings?.has_webhook_api_key ? "Enter new secret to replace" : "webhook-secret"}
              />
            </div>
          </div>
        </div>

        {/* Warning for disabled state */}
        {!isEnabled && settings?.exists && (
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-warning">Custom Settings Disabled</p>
                <p className="text-sm text-muted-foreground mt-1">
                  TTN operations will use global default credentials. Enable to use your custom configuration.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || isSaving}
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>

          <Button onClick={handleSave} disabled={isSaving || isTesting}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
