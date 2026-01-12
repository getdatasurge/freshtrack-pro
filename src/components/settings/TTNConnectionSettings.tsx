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
  Info,
  Pencil,
  X,
  Save
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useTTNConfig } from "@/contexts/TTNConfigContext";
import { TTNConfigSourceBadge } from "@/components/ttn/TTNConfigSourceBadge";
import { TTNDiagnosticsDownload } from "@/components/ttn/TTNDiagnosticsDownload";
import { TTNValidationResultPanel, TTNValidationResult, REQUIRED_SCOPES } from "@/components/ttn/TTNValidationResultPanel";
import { hashConfigValues } from "@/types/ttnState";

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

interface TTNSettings {
  exists: boolean;
  is_enabled: boolean;
  ttn_region: string | null;
  ttn_application_id: string | null;
  // New state machine fields
  provisioning_status: 'idle' | 'provisioning' | 'ready' | 'failed';
  provisioning_step: string | null;
  provisioning_started_at: string | null;
  provisioning_last_heartbeat_at: string | null;
  provisioning_attempt_count: number;
  provisioning_error: string | null;
  last_http_status: number | null;
  last_http_body: string | null;
  // Legacy fields
  provisioning_last_step: string | null;
  provisioning_can_retry: boolean;
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
  readOnly?: boolean;
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

export function TTNConnectionSettings({ organizationId, readOnly = false }: TTNConnectionSettingsProps) {
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

  // Health check state
  const [bootstrapHealthError, setBootstrapHealthError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<TTNValidationResult | null>(null);

  // TTN Config Context for state management
  const { context: ttnContext, setValidated, setCanonical, setInvalid, checkForDrift } = useTTNConfig();

  // Webhook edit mode state
  const [isEditingWebhook, setIsEditingWebhook] = useState(false);
  const [webhookDraft, setWebhookDraft] = useState({
    url: "",
    events: [] as string[],
  });
  const [webhookValidation, setWebhookValidation] = useState({
    isValid: true,
    errors: [] as string[],
    warnings: [] as string[],
  });
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);

  const AVAILABLE_WEBHOOK_EVENTS = [
    { id: "uplink_message", label: "Uplink Message" },
    { id: "join_accept", label: "Join Accept" },
    { id: "downlink_ack", label: "Downlink Ack" },
    { id: "downlink_nack", label: "Downlink Nack" },
    { id: "location_solved", label: "Location Solved" },
  ];

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
        // Map legacy status values
        let status = data.provisioning_status ?? 'idle';
        if (status === 'not_started') status = 'idle';
        if (status === 'completed') status = 'ready';
        
        const loadedSettings: TTNSettings = {
          exists: data.exists ?? false,
          is_enabled: data.is_enabled ?? false,
          ttn_region: data.ttn_region ?? null,
          ttn_application_id: data.ttn_application_id ?? null,
          // New state machine fields
          provisioning_status: status as TTNSettings['provisioning_status'],
          provisioning_step: data.provisioning_step ?? data.provisioning_last_step ?? null,
          provisioning_started_at: data.provisioning_started_at ?? null,
          provisioning_last_heartbeat_at: data.provisioning_last_heartbeat_at ?? null,
          provisioning_attempt_count: data.provisioning_attempt_count ?? 0,
          provisioning_error: data.provisioning_error ?? null,
          last_http_status: data.last_http_status ?? null,
          last_http_body: data.last_http_body ?? null,
          // Legacy fields
          provisioning_last_step: data.provisioning_last_step ?? null,
          provisioning_can_retry: data.provisioning_can_retry ?? true,
          provisioned_at: data.provisioned_at ?? null,
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
        };
        
        setSettings(loadedSettings);
        setRegion(data.ttn_region || "nam1");
        setIsEnabled(data.is_enabled ?? false);
        
        // Set application ID for the form
        if (data.ttn_application_id) {
          setNewApplicationId(data.ttn_application_id);
        }
        
        // Mark context as canonical if we have valid settings from DB
        if (data.exists && data.ttn_application_id) {
          const hash = hashConfigValues({
            cluster: data.ttn_region || 'nam1',
            application_id: data.ttn_application_id,
            api_key_last4: data.api_key_last4,
            is_enabled: data.is_enabled,
          });
          console.log('[TTN Config] Loaded from DB, setting canonical', { 
            org_id: organizationId, 
            app_id: data.ttn_application_id,
            hash 
          });
          setCanonical(hash);
        }
      }
    } catch (err) {
      console.error("Error loading TTN settings:", err);
      toast.error("Failed to load TTN settings");
      setInvalid("Failed to load TTN settings");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, setCanonical, setInvalid]);

  // Check bootstrap service health on mount
  const checkBootstrapHealth = useCallback(async () => {
    try {
      const response = await fetch(
        `https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/ttn-bootstrap`,
        { method: "GET" }
      );
      
      if (!response.ok) {
        setBootstrapHealthError(`Service returned status ${response.status}`);
        return;
      }
      
      const data = await response.json();
      if (data.status !== "ok") {
        setBootstrapHealthError("Service health check failed");
        return;
      }
      
      // Check for expected capabilities
      if (!data.capabilities?.validate_only) {
        setBootstrapHealthError("Service version outdated - missing validate_only capability");
        return;
      }
      
      setBootstrapHealthError(null);
    } catch (err) {
      console.error("Bootstrap health check failed:", err);
      setBootstrapHealthError("Unable to reach TTN bootstrap service");
    }
  }, []);

  // Preflight validation (validate_only) before save
  const runPreflightValidation = useCallback(async () => {
    if (!organizationId) return;
    
    const effectiveAppId = newApplicationId.trim() || settings?.ttn_application_id;
    if (!effectiveAppId || !region) {
      setValidationResult(null);
      return;
    }

    setIsValidating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("ttn-bootstrap", {
        body: {
          action: "validate_only",
          organization_id: organizationId,
          cluster: region,
          application_id: effectiveAppId,
          api_key: newApiKey.trim() || undefined,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      // Case A: Transport error (network, CORS, non-2xx)
      if (error) {
        console.error("[TTN Validation] Transport error:", error);
        toast.error("Connection error", { description: error.message });
        setValidationResult({
          valid: false,
          warnings: ["Unable to reach validation service"],
          error: { code: "TRANSPORT_ERROR", message: error.message },
        });
        setInvalid(error.message);
        return;
      }

      // Case B: Application-level validation (HTTP 200, structured response)
      if (data?.valid || data?.ok) {
        // Validation passed - log as INFO, not ERROR
        console.info("[TTN Validation] Configuration valid", { 
          request_id: data.request_id,
          permissions: data.permissions?.rights?.length || 0
        });
        
        setValidationResult({
          valid: true,
          warnings: data.warnings || [],
          permissions: data.permissions,
          request_id: data.request_id,
          applicationId: effectiveAppId,
        });
        
        // Update TTN config context
        if (data.permissions) {
          setValidated({
            valid: true,
            api_key_type: 'application',
            permissions: {
              applications_read: data.permissions.rights?.includes('RIGHT_APPLICATION_INFO') ?? false,
              applications_write: data.permissions.rights?.includes('RIGHT_APPLICATION_SETTINGS_BASIC') ?? false,
              devices_read: data.permissions.rights?.includes('RIGHT_APPLICATION_DEVICES_READ') ?? false,
              devices_write: data.permissions.rights?.includes('RIGHT_APPLICATION_DEVICES_WRITE') ?? false,
              gateways_read: false,
              gateways_write: false,
              webhooks_write: data.permissions.can_configure_webhook ?? false,
              can_configure_webhook: data.permissions.can_configure_webhook ?? false,
              can_manage_devices: data.permissions.can_manage_devices ?? false,
              can_provision_gateways: false,
              rights: data.permissions.rights || [],
            },
            missing_permissions: data.permissions.missing_core || [],
            invalid_fields: [],
            warnings: data.warnings || [],
            validated_at: new Date().toISOString(),
            request_id: data.request_id || '',
            resolved: { 
              cluster: region, 
              application_id: effectiveAppId,
              organization_id: organizationId,
            },
          });
        }
      } else {
        // Validation failed - NOT a transport error, log as INFO
        console.info("[TTN Validation] Configuration invalid:", {
          code: data?.error?.code,
          message: data?.error?.message,
          request_id: data?.request_id,
        });
        
        setValidationResult({
          valid: false,
          warnings: [],
          error: data?.error,
          request_id: data?.request_id,
          applicationId: effectiveAppId,
          permissions: data?.permissions,
        });
        
        // Update context to invalid state
        setInvalid(data?.error?.message || "Validation failed");
      }
    } catch (err: unknown) {
      // Unexpected error (should be rare)
      const errMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("[TTN Validation] Unexpected error:", err);
      setValidationResult({
        valid: false,
        warnings: ["Unexpected validation error"],
        error: { code: "UNEXPECTED_ERROR", message: errMessage },
      });
      setInvalid(errMessage);
    } finally {
      setIsValidating(false);
    }
  }, [organizationId, region, newApplicationId, newApiKey, settings?.ttn_application_id, setValidated, setInvalid]);

  useEffect(() => {
    loadSettings();
    checkBootstrapHealth();
  }, [loadSettings, checkBootstrapHealth]);

  const handleProvision = async (isRetry: boolean = false, fromStep?: string) => {
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
          action: isRetry ? "retry" : "provision",
          organization_id: organizationId,
          ttn_region: region,
          from_step: fromStep,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("TTN Application provisioned successfully!");
        
        // Set canonical state after successful provisioning
        const hash = hashConfigValues({
          cluster: region,
          application_id: data.application_id || settings?.ttn_application_id,
          is_enabled: true,
        });
        console.log('[TTN Config] Provisioning complete, setting canonical', { hash });
        setCanonical(hash);
        
        await loadSettings();
      } else {
        // Show more helpful error messages
        const errorMsg = data?.error || data?.message || "Provisioning failed";
        const hint = data?.hint || "";
        const isRetryable = data?.retryable;

        if (errorMsg.includes("TTN admin credentials not configured")) {
          toast.error("TTN credentials not configured", {
            description: "Please contact your administrator to set up TTN_ADMIN_API_KEY and TTN_USER_ID secrets.",
          });
        } else if (errorMsg.includes("timed out")) {
          toast.error("Request timed out", {
            description: isRetryable ? "TTN is taking too long to respond. You can retry." : errorMsg,
          });
        } else {
          toast.error(hint ? `${errorMsg}: ${hint}` : errorMsg);
        }
        
        // Refresh to show updated status
        await loadSettings();
      }
    } catch (err: any) {
      console.error("Provisioning error:", err);

      // Check for specific error messages
      if (err.message?.includes("TTN admin credentials")) {
        toast.error("TTN credentials not configured. Please contact your administrator.");
      } else {
        toast.error(err.message || "Failed to provision TTN application");
      }
      
      // Refresh to show current status
      await loadSettings();
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

  // Validate required fields for test connection
  const validateForTest = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!region) {
      errors.push("TTN Region is required");
    }
    // Application ID required
    const effectiveAppId = newApplicationId.trim() || settings?.ttn_application_id;
    if (!effectiveAppId) {
      errors.push("TTN Application ID is required");
    }
    // API key required if no existing key
    if (!settings?.has_api_key && !newApiKey.trim()) {
      errors.push("TTN API Key is required");
    }

    return { valid: errors.length === 0, errors };
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
      
      // Update canonical state with new enabled value
      const hash = hashConfigValues({
        cluster: region,
        application_id: settings?.ttn_application_id,
        api_key_last4: settings?.api_key_last4,
        is_enabled: enabled,
      });
      console.log('[TTN Config] Toggle enabled, setting canonical', { hash, enabled });
      setCanonical(hash);
    } catch (err: any) {
      console.error("Toggle error:", err);
      toast.error(err.message || "Failed to update settings");
      setInvalid(err.message || "Failed to update settings");
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

      // Check for network/invoke errors first
      if (error) {
        console.error("Save API key invoke error:", error);
        toast.error("Connection error", {
          description: error.message || "Failed to reach the server",
        });
        return;
      }

      const result = data as BootstrapResult;
      setBootstrapResult(result);

      if (result?.ok) {
        setNewApiKey("");
        const actionMsg = result.webhook_action === "created"
          ? "Webhook created in TTN"
          : result.webhook_action === "updated"
          ? "Webhook updated in TTN"
          : "Configuration saved";
        toast.success(`API key validated. ${actionMsg}!`);
        
        // Set canonical state after successful save
        const effectiveAppId = newApplicationId.trim() || settings?.ttn_application_id;
        const hash = hashConfigValues({
          cluster: region,
          application_id: effectiveAppId,
          api_key_last4: result.config?.api_key_last4,
          is_enabled: settings?.is_enabled,
        });
        console.log('[TTN Config] API key saved, setting canonical', { hash, app_id: effectiveAppId });
        setCanonical(hash);
        
        await loadSettings();
      } else {
        // Handle structured error from edge function
        const errorCode = result?.error?.code || "UNKNOWN";
        const errorMessage = result?.error?.message || "Configuration failed";
        const errorHint = result?.error?.hint;
        const requestId = result?.request_id;

        console.error("[TTN Bootstrap Error]", { 
          code: errorCode, 
          message: errorMessage,
          hint: errorHint,
          request_id: requestId,
          permissions: result?.permissions,
        });

        // Show appropriate error based on code
        if (errorCode === "TTN_PERMISSION_MISSING") {
          toast.error(errorMessage, {
            description: errorHint,
            duration: 8000,
          });
        } else if (errorCode === "WEBHOOK_SETUP_FAILED") {
          // Parse TTN error for more specific messaging
          const ttnErrorMatch = errorHint?.match(/invalid `([^`]+)`: (.+)/);
          const specificError = ttnErrorMatch 
            ? `TTN rejected ${ttnErrorMatch[1]}: ${ttnErrorMatch[2]}`
            : errorHint;
          
          toast.error("Webhook setup failed", {
            description: specificError || `Request ID: ${requestId}`,
            duration: 8000,
          });
        } else if (errorCode === "INVALID_WEBHOOK_URL") {
          // Server configuration error
          toast.error("Server Configuration Error", {
            description: `${errorMessage}. Request ID: ${requestId}`,
            duration: 10000,
          });
        } else {
          // Show error with hint for all other cases
          toast.error(errorMessage, {
            description: errorHint || `Request ID: ${requestId}`,
            duration: 8000,
          });
        }
      }
    } catch (err: any) {
      console.error("Save API key error:", err);
      toast.error("Unexpected error", {
        description: err.message || "Failed to save and configure TTN",
      });
      setInvalid(err.message || "Failed to save and configure TTN");
    } finally {
      setIsSavingApiKey(false);
    }
  };

  // Add client-side API key format validation
  const validateApiKeyFormat = (key: string): { valid: boolean; warning?: string } => {
    const trimmed = key.trim();
    
    if (trimmed.length === 0) {
      return { valid: false };
    }
    
    // TTN keys typically start with NNSXS.
    if (!trimmed.startsWith("NNSXS.")) {
      return { 
        valid: true, // Let them try, but warn
        warning: "TTN API keys typically start with 'NNSXS.' — make sure you copied the full key" 
      };
    }
    
    // TTN keys are typically 80+ characters
    if (trimmed.length < 80) {
      return {
        valid: true,
        warning: "This key seems shorter than expected — make sure you copied the full key"
      };
    }
    
    return { valid: true };
  };

  const apiKeyValidation = validateApiKeyFormat(newApiKey);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Webhook edit mode functions
  const startEditingWebhook = () => {
    setWebhookDraft({
      url: settings?.webhook_url || WEBHOOK_URL,
      events: settings?.webhook_events || ["uplink_message", "join_accept"],
    });
    setWebhookValidation({ isValid: true, errors: [], warnings: [] });
    setIsEditingWebhook(true);
  };

  const cancelEditingWebhook = () => {
    setIsEditingWebhook(false);
    setWebhookDraft({ url: "", events: [] });
    setWebhookValidation({ isValid: true, errors: [], warnings: [] });
  };

  const validateWebhookDraft = (draft: typeof webhookDraft) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // URL validation
    try {
      const url = new URL(draft.url || "");
      if (url.protocol !== "https:") {
        errors.push("Webhook URL must use HTTPS");
      }
      // Warn if not FrostGuard endpoint
      if (!draft.url?.includes("ttn-webhook")) {
        warnings.push("URL does not match expected FrostGuard endpoint pattern");
      }
    } catch {
      errors.push("Invalid URL format");
    }

    // Events validation
    if (!draft.events || draft.events.length === 0) {
      errors.push("At least one event type must be selected");
    }

    setWebhookValidation({
      isValid: errors.length === 0,
      errors,
      warnings,
    });
  };

  const handleEventToggle = (eventId: string, checked: boolean) => {
    const newEvents = checked
      ? [...webhookDraft.events, eventId]
      : webhookDraft.events.filter((e) => e !== eventId);
    const newDraft = { ...webhookDraft, events: newEvents };
    setWebhookDraft(newDraft);
    validateWebhookDraft(newDraft);
  };

  const handleWebhookUrlChange = (url: string) => {
    const newDraft = { ...webhookDraft, url };
    setWebhookDraft(newDraft);
    validateWebhookDraft(newDraft);
  };

  const handleSaveWebhook = async () => {
    if (!organizationId || !webhookValidation.isValid) return;

    setIsSavingWebhook(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("update-ttn-webhook", {
        body: {
          organization_id: organizationId,
          webhook_url: webhookDraft.url,
          enabled_events: webhookDraft.events,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      if (data?.ok) {
        toast.success("Webhook configuration updated", {
          description: `${data.changes?.length || 0} field(s) changed`,
        });
        setIsEditingWebhook(false);
        
        // Set canonical state after successful webhook save
        const hash = hashConfigValues({
          cluster: region,
          application_id: settings?.ttn_application_id,
          api_key_last4: settings?.api_key_last4,
          is_enabled: settings?.is_enabled,
        });
        console.log('[TTN Config] Webhook saved, setting canonical', { hash });
        setCanonical(hash);
        
        await loadSettings();
      } else {
        toast.error(data?.error?.message || "Failed to update webhook", {
          description: data?.error?.hint,
        });
      }
    } catch (err: any) {
      console.error("Webhook update error:", err);
      toast.error(err.message || "Failed to update webhook configuration");
      setInvalid(err.message || "Failed to update webhook configuration");
    } finally {
      setIsSavingWebhook(false);
    }
  };

  // TIP 1: Generate TTN Setup Instructions for clipboard copy
  const generateTTNSetupInstructions = () => {
    const appId = newApplicationId.trim() || settings?.ttn_application_id || "<your-app-id>";
    const clusterLabel = TTN_REGIONS.find(r => r.value === region)?.label || region;
    
    return `TTN API Key Setup Instructions for FrostGuard

1. Open TTN Console: https://console.cloud.thethings.network
2. Select region: ${clusterLabel}
3. Navigate to: Applications → ${appId}
4. Click: API Keys (left sidebar)
5. Click: "+ Add API Key"
6. Name it: "FrostGuard Integration"
7. Select one of:
   ☐ "Grant all current and future rights" (recommended)
   OR check these specific rights:
   ☑ Read application info
   ☑ Read devices
   ☑ Write devices  
   ☑ Read uplink traffic
   ☑ Write downlink traffic
   ☑ Manage application settings (for webhooks)
8. Click "Create API Key"
9. IMPORTANT: Copy the full key immediately (it won't be shown again)
10. Paste into FrostGuard and click "Validate"

Application ID: ${appId}
Cluster: ${region}
`;
  };

  const handleCopySetupInstructions = async () => {
    const instructions = generateTTNSetupInstructions();
    try {
      await navigator.clipboard.writeText(instructions);
      toast.success("Setup instructions copied!", {
        description: "Paste into your notes or share with team members"
      });
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
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

  const isProvisioned = settings?.provisioning_status === 'ready';
  const isFailed = settings?.provisioning_status === 'failed';
  const isProvisioningStatus = settings?.provisioning_status === 'provisioning';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            TTN Connection
          </CardTitle>
          <div className="flex items-center gap-2">
            <TTNConfigSourceBadge context={ttnContext} size="sm" />
            <TTNDiagnosticsDownload 
              context={ttnContext} 
              organizationId={organizationId}
              settings={settings ? {
                cluster: settings.ttn_region || undefined,
                application_id: settings.ttn_application_id || undefined,
                api_key_last4: settings.api_key_last4 || undefined,
                webhook_url: settings.webhook_url || undefined,
                is_enabled: settings.is_enabled,
              } : undefined}
              variant="ghost"
              size="sm"
            />
          </div>
        </div>
        <CardDescription>
          Connect your LoRaWAN sensors via The Things Network
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Read-only notice for managers */}
        {readOnly && (
          <div className="p-3 rounded-lg bg-muted border border-border/50 flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">View-only access. Contact an admin to make changes.</span>
          </div>
        )}

        {/* Bootstrap Service Health Warning */}
        {bootstrapHealthError && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-warning">TTN Bootstrap Service Issue</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {bootstrapHealthError}. Some TTN configuration features may not work correctly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Provisioning In Progress State */}
        {isProvisioningStatus && (
          <div className="p-6 rounded-lg border-2 border-primary/30 bg-primary/5">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
              <div>
                <h3 className="font-medium">Provisioning TTN Application...</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Creating your dedicated TTN application. This may take up to 60 seconds.
                </p>
                {settings?.provisioning_last_step && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Current step: <span className="font-mono">{settings.provisioning_last_step}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button onClick={loadSettings} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
              </div>
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
              
              <Button onClick={() => handleProvision(false)} disabled={isProvisioning || readOnly} size="lg">
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
              <div className="flex-1 space-y-3">
                <div>
                  <p className="font-medium text-destructive">Provisioning Failed</p>
                  <p className="text-sm text-muted-foreground mt-1">{settings?.provisioning_error}</p>
                  {settings?.provisioning_last_step && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Failed at step: <span className="font-mono">{settings.provisioning_last_step}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!readOnly && settings?.provisioning_can_retry && settings?.provisioning_last_step && (
                    <Button 
                      onClick={() => handleProvision(true, settings.provisioning_last_step!)} 
                      variant="outline" 
                      size="sm" 
                      disabled={isProvisioning}
                    >
                      {isProvisioning ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Retry from {settings.provisioning_last_step}
                    </Button>
                  )}
                  {!readOnly && (
                    <Button 
                      onClick={() => handleProvision(false)} 
                      variant="ghost" 
                      size="sm" 
                      disabled={isProvisioning}
                    >
                      Start Fresh
                    </Button>
                  )}
                </div>
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
                disabled={isSaving || readOnly}
              />
            </div>

            {/* API Key & Webhook Configuration */}
            <div className="space-y-4 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium">TTN API Configuration</Label>
                  <InfoTooltip>Enter your TTN Application ID and API key. Webhook will be configured automatically.</InfoTooltip>
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCopySetupInstructions}
                    className="text-xs h-7 px-2"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Setup Instructions
                  </Button>
                  <Button variant="ghost" size="sm" onClick={loadSettings} disabled={isLoading} className="h-7 px-2">
                    <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
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
                  <Select value={region} onValueChange={setRegion} disabled={readOnly}>
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
                    disabled={readOnly}
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
                    disabled={readOnly}
                  />
                  <p className="text-xs text-muted-foreground">
                    Create a key with: Read/Write application settings, Read/Write devices, Read uplinks
                  </p>
                  {/* API Key Format Warning */}
                  {newApiKey.trim() && apiKeyValidation.warning && (
                    <div className="flex items-start gap-2 p-2 rounded bg-warning/10 border border-warning/30">
                      <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <p className="text-xs text-warning">{apiKeyValidation.warning}</p>
                    </div>
                  )}
                </div>

                {/* Preflight Validation Result Panel */}
                {validationResult && (
                  <TTNValidationResultPanel 
                    result={validationResult}
                    applicationId={newApplicationId.trim() || settings?.ttn_application_id || ""}
                  />
                )}

                {/* Validate & Save Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={runPreflightValidation}
                    disabled={isValidating || !newApplicationId.trim() || readOnly}
                    className="flex-1"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Validate
                      </>
                    )}
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button
                            onClick={handleSaveApiKey}
                            disabled={
                              isSavingApiKey || 
                              !newApiKey.trim() || 
                              !newApplicationId.trim() ||
                              (validationResult !== null && !validationResult.valid) ||
                              readOnly
                            }
                            className="w-full"
                          >
                            {isSavingApiKey ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Configuring...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Save & Configure
                              </>
                            )}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {validationResult && !validationResult.valid && (
                        <TooltipContent className="max-w-xs">
                          <p className="font-medium mb-1">Cannot save - fix these issues:</p>
                          <ul className="text-xs space-y-0.5">
                            {validationResult.permissions?.missing_core?.map(p => {
                              const scope = REQUIRED_SCOPES.find(s => s.right === p);
                              return (
                                <li key={p}>• Missing: {scope?.label || p.replace("RIGHT_APPLICATION_", "").toLowerCase().replace(/_/g, " ")}</li>
                              );
                            })}
                            {validationResult.error && !validationResult.permissions?.missing_core?.length && (
                              <li>• {validationResult.error.message}</li>
                            )}
                          </ul>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            {/* Webhook Configuration */}
            <div className="space-y-4 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-medium">Webhook Configuration</Label>
                </div>
                <div className="flex items-center gap-2">
                  {settings.has_webhook_secret && !isEditingWebhook && (
                    <>
                      <Badge variant="outline" className="bg-safe/10 text-safe border-safe/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Configured
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={startEditingWebhook} disabled={readOnly}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </>
                  )}
                  {isEditingWebhook && (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                      Editing
                    </Badge>
                  )}
                </div>
              </div>

              {/* Edit Mode Warning Banner */}
              {isEditingWebhook && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                    <p className="text-sm text-warning">
                      Changes will update the webhook in TTN immediately upon save.
                    </p>
                  </div>
                </div>
              )}

              {/* Validation Errors */}
              {isEditingWebhook && webhookValidation.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <ul className="text-sm text-destructive space-y-1">
                    {webhookValidation.errors.map((error, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <XCircle className="h-3 w-3" />
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Validation Warnings */}
              {isEditingWebhook && webhookValidation.warnings.length > 0 && webhookValidation.errors.length === 0 && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <ul className="text-sm text-warning space-y-1">
                    {webhookValidation.warnings.map((warning, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Webhook Status Summary - Read Only Mode */}
              {settings.has_webhook_secret && !isEditingWebhook && (
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
                      <div className="flex gap-1 flex-wrap justify-end">
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

              {/* Webhook URL - Editable in Edit Mode */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Webhook URL</Label>
                  <InfoTooltip>
                    {isEditingWebhook 
                      ? "Enter the URL where TTN will send sensor data"
                      : "This URL is automatically configured in your TTN application webhook"
                    }
                  </InfoTooltip>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={isEditingWebhook ? webhookDraft.url : (settings.webhook_url || WEBHOOK_URL)}
                    readOnly={!isEditingWebhook}
                    onChange={(e) => handleWebhookUrlChange(e.target.value)}
                    className={cn(
                      "font-mono text-xs",
                      !isEditingWebhook && "bg-muted"
                    )}
                  />
                  {!isEditingWebhook && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(settings.webhook_url || WEBHOOK_URL, "Webhook URL")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Event Selection - Only in Edit Mode */}
              {isEditingWebhook && (
                <div className="space-y-3">
                  <Label className="text-sm">Enabled Events</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {AVAILABLE_WEBHOOK_EVENTS.map((event) => (
                      <div key={event.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={event.id}
                          checked={webhookDraft.events.includes(event.id)}
                          onCheckedChange={(checked) => handleEventToggle(event.id, !!checked)}
                        />
                        <Label htmlFor={event.id} className="text-sm cursor-pointer">
                          {event.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit Mode Actions */}
              {isEditingWebhook && (
                <div className="flex items-center gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    onClick={cancelEditingWebhook}
                    disabled={isSavingWebhook}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveWebhook}
                    disabled={!webhookValidation.isValid || isSavingWebhook}
                  >
                    {isSavingWebhook ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save Changes
                  </Button>
                </div>
              )}

              {/* Regenerate Webhook Secret - Only in Read Mode */}
              {!isEditingWebhook && (
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
                    disabled={isRegenerating || !settings.has_webhook_secret || readOnly}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
                    Regenerate
                  </Button>
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
