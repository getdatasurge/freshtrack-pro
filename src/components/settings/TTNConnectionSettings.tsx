import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  AlertTriangle,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";

interface TTNSettings {
  exists: boolean;
  is_enabled: boolean;
  ttn_region: string | null;
  ttn_user_id: string | null;
  ttn_application_id: string | null;
  ttn_application_name: string | null;
  derived_application_id: string;
  has_api_key: boolean;
  api_key_last4: string | null;
  api_key_updated_at: string | null;
  has_webhook_secret: boolean;
  webhook_secret_last4: string | null;
  last_connection_test_at: string | null;
  last_connection_test_result: {
    success: boolean;
    error?: string;
    hint?: string;
    message?: string;
    applicationName?: string;
    statusCode?: number;
    effectiveApplicationId?: string;
    apiKeyLast4?: string;
  } | null;
}

const TTN_REGIONS = [
  { value: "nam1", label: "North America (nam1)" },
  { value: "eu1", label: "Europe (eu1)" },
  { value: "au1", label: "Australia (au1)" },
];

interface TTNConnectionSettingsProps {
  organizationId: string | null;
}

export function TTNConnectionSettings({ organizationId }: TTNConnectionSettingsProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [settings, setSettings] = useState<TTNSettings | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  
  // Form state
  const [isEnabled, setIsEnabled] = useState(false);
  const [region, setRegion] = useState("nam1");
  const [userId, setUserId] = useState("");
  const [appId, setAppId] = useState("");
  const [appName, setAppName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
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
      // Force network-verified token refresh
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.warn("[TTNConnectionSettings] No valid session, redirecting to auth");
        setHasSession(false);
        setIsLoading(false);
        toast.error("Session expired. Please sign in again.");
        navigate("/auth");
        return;
      }
      setHasSession(true);

      // Get fresh session for auth header
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("manage-ttn-settings", {
        body: { action: "get", organization_id: organizationId },
        headers: session?.access_token 
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });

      if (error) {
        if (error.message?.includes("401") || error.message?.includes("Invalid JWT")) {
          console.warn("[TTNConnectionSettings] Session expired, redirecting to auth");
          setHasSession(false);
          toast.error("Session expired. Please sign in again.");
          navigate("/auth");
          return;
        }
        throw error;
      }

      setSettings(data);
      setIsEnabled(data.is_enabled || false);
      setRegion(data.ttn_region || "nam1");
      setUserId(data.ttn_user_id || "");
      setAppId(data.ttn_application_id || "");
      setAppName(data.ttn_application_name || "");
    } catch (error) {
      console.error("Failed to load TTN settings:", error);
      toast.error("Failed to load TTN settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Force token refresh
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setHasSession(false);
        toast.error("Session expired. Please sign in again.");
        navigate("/auth");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      const updates: Record<string, unknown> = {
        is_enabled: isEnabled,
        ttn_region: region,
        ttn_user_id: userId || null,
        ttn_application_id: appId || null,
        ttn_application_name: appName || null,
      };

      // Only include keys if changed
      if (apiKey) {
        updates.ttn_api_key = apiKey;
      }
      if (webhookSecret) {
        updates.ttn_webhook_secret = webhookSecret;
      }

      const { data, error } = await supabase.functions.invoke("manage-ttn-settings", {
        body: { action: "update", organization_id: organizationId, ...updates },
        headers: session?.access_token 
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });

      if (error) {
        if (error.message?.includes("401") || error.message?.includes("Invalid JWT")) {
          setHasSession(false);
          toast.error("Session expired. Please sign in again.");
          navigate("/auth");
          return;
        }
        if (error.message?.includes("403")) {
          toast.error("You need admin access to manage TTN settings.");
          return;
        }
        throw error;
      }

      if (data?.error) {
        toast.error(data.error, { description: data.details });
        return;
      }

      toast.success("TTN settings saved");
      setApiKey("");
      setWebhookSecret("");
      await loadSettings();
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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setHasSession(false);
        toast.error("Session expired. Please sign in again.");
        navigate("/auth");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("manage-ttn-settings", {
        body: { action: "test", organization_id: organizationId },
        headers: session?.access_token 
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });

      if (error) {
        if (error.message?.includes("401") || error.message?.includes("Invalid JWT")) {
          setHasSession(false);
          toast.error("Session expired. Please sign in again.");
          navigate("/auth");
          return;
        }
        if (error.message?.includes("403")) {
          toast.error("You need admin access to test TTN connection.");
          return;
        }
        throw error;
      }

      if (data.success) {
        toast.success("Connection successful!", {
          description: data.applicationName 
            ? `Connected to application: ${data.applicationName}`
            : undefined,
        });
      } else {
        toast.error(data.error || "Connection test failed", {
          description: data.hint,
          duration: 10000,
        });
      }

      await loadSettings();
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
  const derivedAppId = settings?.derived_application_id || "fg-your-org";

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
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{testResult.hint}</p>
                )}
                {testResult.applicationName && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Application: {testResult.applicationName}
                  </p>
                )}
                {testResult.statusCode && !testResult.success && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Status code: {testResult.statusCode}
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
            <Select value={region} onValueChange={setRegion}>
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
            <p className="text-xs text-muted-foreground">
              Regional server: {region}.cloud.thethings.network
            </p>
          </div>

          {/* User ID */}
          <div className="space-y-2">
            <Label htmlFor="ttn-user-id">TTN User ID (Optional)</Label>
            <Input
              id="ttn-user-id"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="your-ttn-username"
            />
          </div>
        </div>

        <Separator />

        {/* Application Settings */}
        <div className="space-y-4">
          <Label>Application Settings</Label>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ttn-app-id" className="text-sm text-muted-foreground">
                Application ID (Optional Override)
              </Label>
              <Input
                id="ttn-app-id"
                value={appId}
                onChange={(e) => setAppId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder={derivedAppId}
              />
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                <span>Leave blank to auto-generate: <code className="bg-muted px-1 rounded">{derivedAppId}</code></span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ttn-app-name" className="text-sm text-muted-foreground">
                Application Name (Optional)
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
                Create an API key in TTN Console → Applications → {appId || derivedAppId} → API keys with:
                <br />• applications:read • end_devices:read • end_devices:write
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ttn-webhook-secret" className="text-sm">Webhook Secret (Optional)</Label>
                {settings?.has_webhook_secret && (
                  <Badge variant="outline" className="text-xs">
                    Set (****{settings.webhook_secret_last4})
                  </Badge>
                )}
              </div>
              <Input
                id="ttn-webhook-secret"
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder={settings?.has_webhook_secret ? "Enter new secret to replace" : "webhook-secret"}
              />
              <p className="text-xs text-muted-foreground">
                Used to verify webhook requests from TTN (optional but recommended)
              </p>
            </div>
          </div>
        </div>

        {/* Warning when disabled but has settings */}
        {!isEnabled && settings?.exists && settings?.has_api_key && (
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-warning">TTN Integration Disabled</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Enable the toggle above to use your TTN configuration for device provisioning.
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
            disabled={isTesting || isSaving || (!settings?.has_api_key && !apiKey)}
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
