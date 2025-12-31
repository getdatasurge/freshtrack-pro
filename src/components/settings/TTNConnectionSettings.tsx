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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  ExternalLink,
} from "lucide-react";

interface TTNSettings {
  exists: boolean;
  is_enabled: boolean;
  ttn_region: string | null;
  has_api_key: boolean;
  api_key_last4: string | null;
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
  global_application_id: string | null;
}

const TTN_REGIONS = [
  { value: "nam1", label: "North America (nam1)" },
  { value: "eu1", label: "Europe (eu1)" },
  { value: "au1", label: "Australia (au1)" },
];

interface TTNConnectionSettingsProps {
  organizationId: string | null;
}

// Reusable InfoTooltip component for consistent styling
const InfoTooltip = ({ children }: { children: React.ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className="inline-flex items-center justify-center ml-1.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full transition-colors"
        aria-label="More information"
      >
        <Info className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="right" className="max-w-xs text-left p-3">
      {children}
    </TooltipContent>
  </Tooltip>
);

// Helper function to get actionable guidance based on test result errors
const getTestResultGuidance = (testResult: TTNSettings['last_connection_test_result']) => {
  if (!testResult || testResult.success) return null;
  
  const error = testResult.error?.toLowerCase() || '';
  const statusCode = testResult.statusCode;
  
  if (statusCode === 401 || error.includes('permission') || error.includes('unauthorized') || error.includes('api key')) {
    return {
      title: "API Key Permission Issue",
      icon: Key,
      steps: [
        "Verify your API key has not expired",
        "Ensure permissions include: applications:read, end_devices:read, end_devices:write",
        "Confirm the key belongs to the correct TTN application",
        "Check the key starts with 'NNSXS.'"
      ]
    };
  }
  
  if (statusCode === 404 || error.includes('not found') || error.includes('application')) {
    return {
      title: "Application Not Found",
      icon: AlertTriangle,
      steps: [
        "Check if the Application ID exists in your selected region",
        "Verify the region matches your TTN Console URL",
        "Ensure the API key was created for the correct application",
        "Try selecting a different region if unsure"
      ]
    };
  }
  
  if (error.includes('network') || error.includes('timeout') || error.includes('connection')) {
    return {
      title: "Connection Error",
      icon: RefreshCw,
      steps: [
        "Check your internet connection",
        "TTN servers may be temporarily unavailable",
        "Try again in a few minutes"
      ]
    };
  }
  
  return null;
};

export function TTNConnectionSettings({ organizationId }: TTNConnectionSettingsProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [settings, setSettings] = useState<TTNSettings | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  
  // Form state (simplified - only region, api key, webhook secret)
  const [isEnabled, setIsEnabled] = useState(false);
  const [region, setRegion] = useState("nam1");
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
  const globalAppId = settings?.global_application_id;
  const testGuidance = getTestResultGuidance(testResult);

  return (
    <TooltipProvider delayDuration={300}>
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
              <InfoTooltip>
                <div className="space-y-2">
                  <p className="font-medium">Enable TTN Integration</p>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li>• Connects FreshGuard to The Things Network</li>
                    <li>• Enables automatic device provisioning</li>
                    <li>• Receives real-time sensor data via LoRaWAN</li>
                    <li>• Requires a valid API key before enabling</li>
                  </ul>
                </div>
              </InfoTooltip>
              <Switch
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
                aria-label="Enable TTN integration"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Connection Status - Enhanced with actionable guidance */}
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
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${testResult.success ? "text-safe" : "text-destructive"}`}>
                      {testResult.success ? "Connection Successful" : testResult.error || "Connection Failed"}
                    </p>
                    {testResult.success && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-safe hover:text-safe/80 focus:outline-none"
                            aria-label="What was tested"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs p-3">
                          <p className="font-medium mb-2">Validated Successfully:</p>
                          <ul className="text-xs space-y-1 text-muted-foreground">
                            <li>✓ API key authentication</li>
                            <li>✓ Application access permissions</li>
                            <li>✓ Region connectivity ({region}.cloud.thethings.network)</li>
                            <li>✓ Device read/write capabilities</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {testResult.hint && (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{testResult.hint}</p>
                  )}
                  {testResult.applicationName && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Application: {testResult.applicationName}
                    </p>
                  )}
                  
                  {/* Enhanced error guidance */}
                  {testGuidance && (
                    <div className="mt-3 p-3 rounded bg-background/50 border border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <testGuidance.icon className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-sm">{testGuidance.title}</p>
                      </div>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {testGuidance.steps.map((step, i) => (
                          <li key={i}>• {step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {testResult.statusCode && !testResult.success && !testGuidance && (
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

          {/* Global Application ID notice - Enhanced with tooltip */}
          {globalAppId && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">TTN Application:</span>{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{globalAppId}</code>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All devices are registered under this shared application.
                  </p>
                </div>
                <InfoTooltip>
                  <div className="space-y-2">
                    <p className="font-medium">TTN Application ID</p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• Configured by your administrator</li>
                      <li>• All sensors register under this app</li>
                      <li>• Your API key must have access to this application</li>
                      <li>• Cannot be changed from this screen</li>
                    </ul>
                  </div>
                </InfoTooltip>
              </div>
            </div>
          )}

          {!globalAppId && (
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                <div>
                  <p className="font-medium text-warning">TTN Application Not Configured</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The TTN_APPLICATION_ID environment variable is not set. Contact your administrator.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Region Selection - Enhanced with tooltip */}
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor="ttn-region">TTN Region</Label>
              <InfoTooltip>
                <div className="space-y-2">
                  <p className="font-medium">Select Your TTN Region</p>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li>• Must match the cluster where your TTN application was created</li>
                    <li>• <strong>North America:</strong> nam1.cloud.thethings.network</li>
                    <li>• <strong>Europe:</strong> eu1.cloud.thethings.network</li>
                    <li>• <strong>Australia:</strong> au1.cloud.thethings.network</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                    <strong>Tip:</strong> Check your TTN Console URL to confirm your region.
                  </p>
                </div>
              </InfoTooltip>
            </div>
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Regional server: {region}.cloud.thethings.network</span>
              <InfoTooltip>
                <div className="space-y-2">
                  <p className="font-medium">Server URLs (Auto-configured)</p>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li>• <strong>Stack URL:</strong> {region}.cloud.thethings.network</li>
                    <li>• <strong>Identity Server:</strong> eu1.cloud.thethings.network (always EU)</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                    These are automatically derived from your region selection.
                  </p>
                </div>
              </InfoTooltip>
            </div>
          </div>

          <Separator />

          {/* API Key - Enhanced with comprehensive tooltip */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <Label>API Authentication</Label>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Label htmlFor="ttn-api-key" className="text-sm">TTN API Key</Label>
                    <InfoTooltip>
                      <div className="space-y-2">
                        <p className="font-medium">How to Create a TTN API Key</p>
                        <ol className="text-xs space-y-1.5 text-muted-foreground list-decimal list-inside">
                          <li>Go to <strong>TTN Console</strong> → <strong>Applications</strong></li>
                          <li>Select your application: <code className="bg-muted px-1 rounded">{globalAppId || 'your-app-id'}</code></li>
                          <li>Click <strong>API keys</strong> → <strong>Add API key</strong></li>
                          <li>Grant these permissions:
                            <ul className="ml-4 mt-1 space-y-0.5">
                              <li>• <code className="bg-muted px-1 rounded">applications:read</code></li>
                              <li>• <code className="bg-muted px-1 rounded">end_devices:read</code></li>
                              <li>• <code className="bg-muted px-1 rounded">end_devices:write</code></li>
                            </ul>
                          </li>
                          <li>Copy the key immediately (starts with <code className="bg-muted px-1 rounded">NNSXS.</code>)</li>
                        </ol>
                        <p className="text-xs text-warning mt-2 pt-2 border-t border-border/50">
                          ⚠️ Keys cannot be viewed again after creation!
                        </p>
                      </div>
                    </InfoTooltip>
                  </div>
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
                    className="pr-10 font-mono"
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
                  Required permissions: applications:read, end_devices:read, end_devices:write
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Label htmlFor="ttn-webhook-secret" className="text-sm">Webhook Secret</Label>
                    <InfoTooltip>
                      <div className="space-y-2">
                        <p className="font-medium">Webhook Secret (Optional)</p>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          <li>• Used to verify incoming webhook requests from TTN</li>
                          <li>• Only required if you've configured a webhook in TTN Console</li>
                          <li>• Must match the secret set in TTN → Webhooks → X-Webhook-Secret header</li>
                          <li>• Leaving blank is valid if not using webhooks</li>
                        </ul>
                        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                          <strong>Recommended:</strong> Set this for added security when receiving sensor data.
                        </p>
                      </div>
                    </InfoTooltip>
                    <Badge variant="secondary" className="ml-2 text-xs">Optional</Badge>
                  </div>
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
                  placeholder={settings?.has_webhook_secret ? "Enter new secret to replace" : "your-webhook-secret"}
                />
                <p className="text-xs text-muted-foreground">
                  Must match the X-Webhook-Secret header configured in your TTN webhook
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
                    TTN settings are configured but the integration is disabled. 
                    Enable it above to start receiving sensor data.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Actions - Enhanced with tooltips */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting || !settings?.has_api_key || !globalAppId}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
              {!settings?.has_api_key && (
                <span className="text-xs text-muted-foreground">Save an API key first</span>
              )}
            </div>

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
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

          {/* Quick Help Link */}
          <div className="pt-2 border-t border-border/50">
            <a
              href="https://www.thethingsindustries.com/docs/getting-started/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              TTN Getting Started Guide
            </a>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
