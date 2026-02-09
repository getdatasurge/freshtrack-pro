import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, RefreshCw, Key, Building2, ExternalLink, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, PlayCircle, Info, Trash2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SecretField } from "./SecretField";
import { TTNDiagnosticsPanel } from "@/components/ttn/TTNDiagnosticsPanel";

type SecretStatus = "provisioned" | "missing" | "invalid" | "decryption_failed";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TTNCredentials {
  organization_name: string;
  organization_id: string;
  ttn_application_id: string | null;
  ttn_region: string | null;
  org_api_secret: string | null;
  org_api_secret_last4: string | null;
  org_api_secret_status?: 'empty' | 'decrypted' | 'failed';
  app_api_secret: string | null;
  app_api_secret_last4: string | null;
  app_api_secret_status?: 'empty' | 'decrypted' | 'failed';
  webhook_secret: string | null;
  webhook_secret_last4: string | null;
  webhook_secret_status?: 'empty' | 'decrypted' | 'failed';
  webhook_url: string | null;
  provisioning_status: 'idle' | 'provisioning' | 'ready' | 'failed' | string | null;
  provisioning_step: string | null;
  provisioning_step_details: {
    preflight_done?: boolean;
    organization_created?: boolean;
    org_api_key_created?: boolean;
    application_created?: boolean;
    app_rights_verified?: boolean;
    app_api_key_created?: boolean;
    webhook_created?: boolean;
  } | null;
  provisioning_error: string | null;
  provisioning_attempt_count: number | null;
  last_http_status: number | null;
  last_http_body: string | null;
  credentials_last_rotated_at: string | null;
  // New diagnostics fields
  app_rights_check_status: string | null;
  last_ttn_correlation_id: string | null;
  last_ttn_error_name: string | null;
}

interface TTNCredentialsPanelProps {
  organizationId: string | null;
  readOnly?: boolean;
}

// Define provisioning steps for step tracker (organization-based flow)
const PROVISIONING_STEPS = [
  { id: 'preflight', label: 'Preflight Check', description: 'Verify TTN admin credentials' },
  { id: 'create_organization', label: 'Create Organization', description: 'Create TTN organization for tenant isolation' },
  { id: 'create_org_api_key', label: 'Create Org API Key', description: 'Create org-scoped API key' },
  { id: 'create_application', label: 'Create Application', description: 'Create TTN application under org' },
  { id: 'verify_application_rights', label: 'Verify App Rights', description: 'Check application ownership' },
  { id: 'create_app_api_key', label: 'Create App API Key', description: 'Create application API key' },
  { id: 'create_webhook', label: 'Create Webhook', description: 'Configure webhook endpoint' },
  { id: 'complete', label: 'Complete', description: 'Provisioning finished' },
];

export function TTNCredentialsPanel({ organizationId, readOnly = false }: TTNCredentialsPanelProps) {
  const [credentials, setCredentials] = useState<TTNCredentials | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isStartingFresh, setIsStartingFresh] = useState(false);
  const [isDeepCleaning, setIsDeepCleaning] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeepCleanDialog, setShowDeepCleanDialog] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [deepCleanConfirmChecked, setDeepCleanConfirmChecked] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // NAM1 ONLY - hardcoded cluster, no region selection
  const targetRegion = "nam1";

  // Track the last known organizationId to prevent clearing credentials during transitional states
  const lastOrgIdRef = useRef<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    // Don't clear credentials if organizationId is temporarily null (transitional state)
    if (!organizationId) {
      // Only clear if we never had an org before
      if (!lastOrgIdRef.current) {
        setIsLoading(false);
        setCredentials(null);
        setFetchError(null);
      }
      return;
    }

    // If switching to a DIFFERENT org, clear old credentials first
    if (lastOrgIdRef.current && lastOrgIdRef.current !== organizationId) {
      setCredentials(null);
    }
    lastOrgIdRef.current = organizationId;

    // Always show loading state when starting a fetch
    setIsLoading(true);
    setFetchError(null);
    
    try {
      // Force network-verified token refresh before invoking
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setFetchError("Session expired - please sign in again");
        return;
      }

      const { data, error } = await supabase.functions.invoke("manage-ttn-settings", {
        body: { 
          action: "get_credentials",
          organization_id: organizationId 
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCredentials(data);
    } catch (err) {
      console.error("Failed to fetch TTN credentials:", err);
      setFetchError("Unable to load TTN settings");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // handleStartFreshWithConfirm - called from confirmation dialog
  const handleStartFreshWithConfirm = async () => {
    setShowConfirmDialog(false);
    setConfirmChecked(false);
    await handleStartFresh();
  };

  const handleRetryProvisioning = async () => {
    if (!organizationId) return;

    setIsRetrying(true);
    try {
      // Force network-verified token refresh before invoking (same as fetchCredentials)
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast.error("Session expired - please sign in again");
        return;
      }

      // If status is failed, use manage-ttn-settings to reset state first
      // Otherwise call ttn-provision-org directly
      const isFailed = credentials?.provisioning_status === 'failed';
      
      const { data, error } = isFailed 
        ? await supabase.functions.invoke("manage-ttn-settings", {
            body: { 
              action: "retry_provisioning",
              organization_id: organizationId,
            },
          })
        : await supabase.functions.invoke("ttn-provision-org", {
            body: { 
              action: "retry",
              organization_id: organizationId,
            },
          });

      // Handle transport errors
      if (error) {
        console.error("Transport error:", error);
        toast.error(error.message || "Failed to connect");
        return;
      }

      // Handle structured responses (HTTP 200 with success:false)
      if (data && !data.success) {
        if (data.use_start_fresh) {
          toast.error("Cannot retry - use Start Fresh", {
            description: data.message || "Application is owned by different account",
          });
        } else {
          toast.error(data.error || "Provisioning failed", {
            description: data.message,
          });
        }
        await fetchCredentials();
        return;
      }

      toast.success("Provisioning retry initiated");
      setTimeout(fetchCredentials, 2000);
    } catch (err: any) {
      console.error("Failed to retry provisioning:", err);
      toast.error(err.message || "Failed to retry provisioning");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleStartFresh = async () => {
    if (!organizationId) return;

    setIsStartingFresh(true);
    try {
      // Force network-verified token refresh before invoking (same as fetchCredentials)
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast.error("Session expired - please sign in again");
        return;
      }

      const { data, error } = await supabase.functions.invoke("ttn-provision-org", {
        body: { 
          action: "start_fresh",
          organization_id: organizationId,
          ttn_region: "nam1", // NAM1 ONLY - hardcoded cluster
        },
      });

      // Handle transport errors
      if (error) {
        console.error("Transport error:", error);
        toast.error(error.message || "Failed to connect");
        return;
      }

      // Handle structured responses
      if (data && !data.success) {
        toast.error(data.error || "Start Fresh failed", {
          description: data.message,
        });
        await fetchCredentials();
        return;
      }

      toast.success("Start Fresh completed", {
        description: "Provisioned on NAM1 cluster successfully",
      });
      setTimeout(fetchCredentials, 2000);
    } catch (err: any) {
      console.error("Failed to start fresh:", err);
      toast.error(err.message || "Failed to start fresh");
    } finally {
      setIsStartingFresh(false);
    }
  };

  const handleDeepClean = async () => {
    if (!organizationId) return;

    setIsDeepCleaning(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast.error("Session expired - please sign in again");
        return;
      }

      const { data, error } = await supabase.functions.invoke("ttn-provision-org", {
        body: { 
          action: "deep_clean",
          organization_id: organizationId,
          ttn_region: "nam1", // NAM1 ONLY - hardcoded cluster
        },
      });

      if (error) {
        console.error("Transport error:", error);
        toast.error(error.message || "Failed to connect");
        return;
      }

      if (data && !data.success) {
        toast.error(data.error || "Deep clean failed", {
          description: data.message,
        });
        await fetchCredentials();
        return;
      }

      toast.success("Deep clean completed", {
        description: `Deleted ${data.deleted_devices || 0} devices. ${data.deleted_org ? 'Organization deleted.' : ''} Ready to provision on NAM1.`,
      });
      
      // Close dialog and refresh
      setShowDeepCleanDialog(false);
      setDeepCleanConfirmChecked(false);
      setTimeout(fetchCredentials, 2000);
    } catch (err: any) {
      console.error("Failed to deep clean:", err);
      toast.error(err.message || "Failed to deep clean");
    } finally {
      setIsDeepCleaning(false);
    }
  };

  // Check if the error indicates an unowned application
  const isUnownedAppError = () => {
    if (!credentials) return false;
    return credentials.app_rights_check_status === "forbidden" ||
           credentials.last_ttn_error_name === "no_application_rights" ||
           credentials.last_http_body?.includes("no_application_rights");
  };

  // Check if the error indicates no organization rights
  const isNoOrgRightsError = () => {
    if (!credentials) return false;
    return credentials.last_ttn_error_name === "no_organization_rights" ||
           credentials.last_http_body?.includes("no_organization_rights");
  };

  const handleCheckStatus = async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ttn-provision-org", {
        body: { 
          action: "status",
          organization_id: organizationId,
        },
      });

      if (error) throw error;
      
      // Refresh full credentials after status check
      await fetchCredentials();
      toast.success("Status refreshed");
    } catch (err: any) {
      console.error("Failed to check status:", err);
      toast.error(err.message || "Failed to check status");
    } finally {
      setIsLoading(false);
    }
  };

  const getOverallStatus = () => {
    if (!credentials) return "missing";
    
    const hasApp = Boolean(credentials.app_api_secret || credentials.app_api_secret_last4);
    const hasWebhook = Boolean(credentials.webhook_secret || credentials.webhook_secret_last4);
    const hasUrl = Boolean(credentials.webhook_url);
    
    if (hasApp && hasWebhook && hasUrl) return "provisioned";
    if (hasApp || hasWebhook || hasUrl) return "partial";
    return "missing";
  };

  // Helper to determine secret field status based on decryption result
  const getSecretStatus = (
    value: string | null | undefined,
    last4: string | null | undefined,
    decryptStatus?: 'empty' | 'decrypted' | 'failed'
  ): SecretStatus => {
    // If decryption explicitly failed but we have last4, show "decryption_failed"
    if (decryptStatus === 'failed' && last4) {
      return 'decryption_failed';
    }
    // If we have value or last4, it's provisioned
    if (value || last4) {
      return 'provisioned';
    }
    // Otherwise it's missing
    return 'missing';
  };

  const getStatusBadge = () => {
    const status = credentials?.provisioning_status;
    if (status === 'provisioning') {
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Provisioning...</Badge>;
    }
    if (status === 'failed') {
      return <Badge variant="outline" className="bg-alarm/10 text-alarm border-alarm/30">Failed</Badge>;
    }
    if (status === 'ready') {
      return <Badge variant="outline" className="bg-safe/10 text-safe border-safe/30">Fully Provisioned</Badge>;
    }
    
    const overallStatus = getOverallStatus();
    switch (overallStatus) {
      case "provisioned":
        return <Badge variant="outline" className="bg-safe/10 text-safe border-safe/30">Fully Provisioned</Badge>;
      case "partial":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Partially Configured</Badge>;
      case "missing":
        return <Badge variant="outline" className="bg-alarm/10 text-alarm border-alarm/30">Not Configured</Badge>;
    }
  };

  const getStepStatus = (stepId: string) => {
    if (!credentials) return 'pending';
    const status = credentials.provisioning_status;
    const stepDetails = credentials.provisioning_step_details;
    
    // If overall status is ready, all steps are complete
    if (status === 'ready' || status === 'completed') return 'success';
    
    // Map step IDs to step_details keys
    const stepToDetailKey: Record<string, keyof NonNullable<typeof stepDetails>> = {
      'preflight': 'preflight_done',
      'create_organization': 'organization_created',
      'create_org_api_key': 'org_api_key_created',
      'create_application': 'application_created',
      'verify_application_rights': 'app_rights_verified',
      'create_app_api_key': 'app_api_key_created',
      'create_webhook': 'webhook_created',
    };
    
    // Check step_details for completion status
    const detailKey = stepToDetailKey[stepId];
    if (detailKey && stepDetails?.[detailKey]) {
      return 'success';
    }
    
    // 'complete' step is success only if overall status is ready
    if (stepId === 'complete') {
      return status === 'ready' ? 'success' : 'pending';
    }
    
    // Check if this is the currently failing step
    const currentStep = credentials.provisioning_step;
    if (status === 'failed' && currentStep === stepId) return 'failed';
    if (status === 'provisioning' && currentStep === stepId) return 'running';
    
    return 'pending';
  };

  const renderStepIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-safe" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-alarm" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Helper to render structured skeleton for credential fields
  const renderCredentialSkeleton = (label: string) => (
    <div key={label} className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-64" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
    </div>
  );

  return (
    <>
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">TTN Credentials</CardTitle>
                <CardDescription>
                  Manage your Things Network API keys and webhook secrets
                </CardDescription>
              </div>
            </div>
            {!isLoading && getStatusBadge()}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {/* Skeleton for Org Info section */}
              <Skeleton className="h-20 w-full rounded-lg" />
              
              {/* Skeleton rows matching SecretField layout */}
              {["Organization API Secret", "Application API Secret", "Webhook Secret", "Webhook URL"].map(renderCredentialSkeleton)}
            </div>
          ) : (
            <>
              {/* Fetch Error Banner */}
              {fetchError && (
                <div className="p-3 bg-alarm/10 rounded-lg border border-alarm/30 flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-alarm flex-shrink-0" />
                  <span className="text-alarm flex-1">{fetchError}</span>
                  <Button variant="ghost" size="sm" onClick={fetchCredentials} disabled={isLoading}>
                    Retry
                  </Button>
                </div>
              )}

              {/* Organization Info - always render */}
              <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                {organizationId && credentials ? (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{credentials.organization_name}</div>
                    <div className="text-sm text-muted-foreground font-mono truncate">
                      {credentials.organization_id}
                    </div>
                    {credentials.ttn_application_id && (
                      <div className="text-sm text-muted-foreground mt-1">
                        <span className="text-foreground">Application:</span>{" "}
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                          {credentials.ttn_application_id}
                        </code>
                        {credentials.ttn_region && (
                          <span className="ml-2 text-xs">({credentials.ttn_region})</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 text-sm text-muted-foreground italic">
                    {!organizationId ? "No organization selected" : "Organization info unavailable"}
                  </div>
                )}
              </div>

              {/* Credential Fields - ALWAYS render these 4 rows */}
              <div className="space-y-4">
                <SecretField
                  label="Organization API Secret"
                  value={credentials?.org_api_secret ?? null}
                  last4={credentials?.org_api_secret_last4 ?? null}
                  status={getSecretStatus(credentials?.org_api_secret, credentials?.org_api_secret_last4, credentials?.org_api_secret_status)}
                  description="Used for gateway registry and organization-level operations"
                />

                <SecretField
                  label="Application API Secret"
                  value={credentials?.app_api_secret ?? null}
                  last4={credentials?.app_api_secret_last4 ?? null}
                  status={getSecretStatus(credentials?.app_api_secret, credentials?.app_api_secret_last4, credentials?.app_api_secret_status)}
                  description="Used for device provisioning and application operations"
                />

                <SecretField
                  label="Webhook Secret"
                  value={credentials?.webhook_secret ?? null}
                  last4={credentials?.webhook_secret_last4 ?? null}
                  status={getSecretStatus(credentials?.webhook_secret, credentials?.webhook_secret_last4, credentials?.webhook_secret_status)}
                  description="Used to verify incoming webhook payloads from TTN"
                />

                <SecretField
                  label="Webhook URL"
                  value={credentials?.webhook_url ?? null}
                  status={credentials?.webhook_url ? "provisioned" : "missing"}
                  isSecret={false}
                  description="The endpoint TTN sends uplink messages to"
                />
              </div>

              {/* Last Rotation Info */}
              {credentials?.credentials_last_rotated_at && (
                <p className="text-xs text-muted-foreground">
                  Last rotated: {new Date(credentials.credentials_last_rotated_at).toLocaleString()}
                </p>
              )}

              {/* TTN Diagnostics Panel */}
              {credentials && (
                <TTNDiagnosticsPanel 
                  data={{
                    ttn_region: credentials.ttn_region,
                    ttn_application_id: credentials.ttn_application_id,
                    provisioning_status: credentials.provisioning_status,
                    last_http_status: credentials.last_http_status,
                    last_http_body: credentials.last_http_body,
                    webhook_url: credentials.webhook_url,
                    webhook_secret_last4: credentials.webhook_secret_last4,
                  }}
                  className="mt-3"
                />
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50">
                {/* Read-only notice for managers */}
                {readOnly && (
                  <Badge variant="secondary" className="gap-1">
                    <Info className="h-3 w-3" />
                    View Only
                  </Badge>
                )}

                {/* NAM1 Only - Display current cluster info (read-only) */}
                {organizationId && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      NAM1 (North America)
                    </Badge>
                    {credentials?.ttn_region && credentials.ttn_region !== "nam1" && (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                        Migrating from {credentials.ttn_region.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Show provisioning buttons when credentials missing or failed - only for admins/owners */}
                {!readOnly && (!credentials || credentials?.provisioning_status === 'failed' || !credentials?.ttn_application_id) && organizationId && (
                  <>
                    {/* Primary action: Retry/Start Provisioning */}
                    <Button
                      variant="default"
                      onClick={handleRetryProvisioning}
                      disabled={isRetrying || isLoading || !organizationId}
                      className="gap-2"
                    >
                      <PlayCircle className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
                      {credentials?.ttn_application_id ? "Retry Provisioning" : "Start Provisioning"}
                    </Button>
                    
                    {/* Always show Start Fresh as secondary option when there's existing data or failed status */}
                    {(credentials?.ttn_application_id || credentials?.provisioning_status === 'failed') && (
                      <Button
                        variant="outline"
                        onClick={handleStartFresh}
                        disabled={isStartingFresh || isLoading}
                        className="gap-2"
                      >
                        <RefreshCw className={`h-4 w-4 ${isStartingFresh ? "animate-spin" : ""}`} />
                        Start Fresh
                      </Button>
                    )}
                  </>
                )}
                
                <Button
                  variant="outline"
                  onClick={handleCheckStatus}
                  disabled={isLoading || !organizationId}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Check Status
                </Button>

                {/* Start Fresh - always available when provisioned */}
                {!readOnly && credentials?.ttn_application_id && credentials?.provisioning_status === 'ready' && (
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={isStartingFresh || isLoading}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isStartingFresh ? "animate-spin" : ""}`} />
                    Start Fresh
                  </Button>
                )}

                {/* Deep Clean - nuclear option for cluster issues */}
                {!readOnly && credentials?.ttn_application_id && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeepCleanDialog(true)}
                    disabled={isDeepCleaning || isLoading}
                    className="gap-2"
                  >
                    <Trash2 className={`h-4 w-4 ${isDeepCleaning ? "animate-spin" : ""}`} />
                    Deep Clean
                  </Button>
                )}

                {credentials?.ttn_application_id && credentials?.ttn_region && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="gap-2 text-muted-foreground"
                  >
                    <a
                      href={`https://${credentials.ttn_region}.cloud.thethings.network/console/applications/${credentials.ttn_application_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open in TTN Console
                    </a>
                  </Button>
                )}
              </div>

              {/* Step Tracker - show when provisioning or failed */}
              {credentials && (credentials.provisioning_status === 'provisioning' || credentials.provisioning_status === 'failed') && (
                <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                  <h4 className="text-sm font-medium mb-3">Provisioning Steps</h4>
                  <div className="space-y-2">
                    {PROVISIONING_STEPS.map((step) => {
                      const status = getStepStatus(step.id);
                      return (
                        <div key={step.id} className="flex items-center gap-3 text-sm">
                          {renderStepIcon(status)}
                          <span className={status === 'pending' ? 'text-muted-foreground' : ''}>{step.label}</span>
                          {status === 'running' && (
                            <span className="text-xs text-muted-foreground">(in progress)</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {credentials.provisioning_attempt_count && credentials.provisioning_attempt_count > 1 && (
                    <p className="text-xs text-muted-foreground mt-3">
                      Attempt {credentials.provisioning_attempt_count}
                    </p>
                  )}
                </div>
              )}

              {/* Error Details - show when failed */}
              {credentials?.provisioning_status === 'failed' && credentials?.provisioning_error && (
                <Collapsible open={showErrorDetails} onOpenChange={setShowErrorDetails}>
                  <div className="mt-4 p-4 bg-alarm/10 rounded-lg border border-alarm/30">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-alarm flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-alarm">Provisioning Failed</p>
                        <p className="text-sm text-muted-foreground mt-1">{credentials.provisioning_error}</p>
                        
                        {/* Special message for unowned app error */}
                        {isUnownedAppError() && !isNoOrgRightsError() && (
                          <div className="mt-3 p-3 bg-warning/10 rounded border border-warning/30 text-sm">
                            <p className="font-medium text-warning">Application Ownership Issue</p>
                            <p className="text-muted-foreground mt-1">
                              This TTN application exists but the current provisioning key has no rights to it. 
                              This commonly happens with legacy apps created under another account.
                            </p>
                            <p className="text-foreground mt-2">
                              Use <strong>Start Fresh</strong> to recreate or generate a new app ID under the current key.
                            </p>
                          </div>
                        )}
                        
                        {/* Special message for no organization rights */}
                        {isNoOrgRightsError() && (
                          <div className="mt-3 p-3 bg-alarm/10 rounded border border-alarm/30 text-sm">
                            <p className="font-medium text-alarm">No Organization Rights</p>
                            <p className="text-muted-foreground mt-1">
                              The TTN organization exists but the current provisioning key has no rights to it. 
                              This usually means the organization was created under another account or on a different cluster.
                            </p>
                            <p className="text-foreground mt-2">
                              Use <strong>Start Fresh</strong> to attempt with a new organization ID, or verify your TTN admin key has the correct rights.
                            </p>
                          </div>
                        )}
                        
                        {(credentials.last_http_status || credentials.last_http_body || credentials.last_ttn_correlation_id) && (
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="mt-2 h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
                              {showErrorDetails ? (
                                <>Hide Details <ChevronUp className="h-3 w-3 ml-1" /></>
                              ) : (
                                <>Show Details <ChevronDown className="h-3 w-3 ml-1" /></>
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        )}
                        
                        <CollapsibleContent>
                          <div className="mt-3 p-3 bg-muted/50 rounded text-xs font-mono space-y-2">
                            {credentials.last_http_status && (
                              <div>
                                <span className="text-muted-foreground">HTTP Status:</span>{" "}
                                <span className="text-alarm">{credentials.last_http_status}</span>
                              </div>
                            )}
                            {credentials.last_ttn_error_name && (
                              <div>
                                <span className="text-muted-foreground">Error:</span>{" "}
                                <span className="text-alarm">{credentials.last_ttn_error_name}</span>
                              </div>
                            )}
                            {credentials.last_ttn_correlation_id && (
                              <div>
                                <span className="text-muted-foreground">Correlation ID:</span>{" "}
                                <span className="text-foreground/70">{credentials.last_ttn_correlation_id}</span>
                              </div>
                            )}
                            {credentials.last_http_body && (
                              <div>
                                <span className="text-muted-foreground">Response:</span>
                                <pre className="mt-1 whitespace-pre-wrap break-all text-foreground/70">
                                  {credentials.last_http_body}
                                </pre>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </div>
                  </div>
                </Collapsible>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Start Fresh Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Start Fresh on NAM1?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>This will deprovision and re-provision all TTN resources on NAM1. This action:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Creates a new TTN application with fresh credentials on <strong>NAM1</strong></li>
                <li>Invalidates all existing API keys immediately</li>
                <li>May temporarily interrupt active sensor connections</li>
                <li>All devices will need to rejoin the new application</li>
                {credentials?.ttn_region && credentials.ttn_region !== "nam1" && (
                  <li className="text-warning font-medium">
                    Migrates from {credentials.ttn_region.toUpperCase()} to NAM1 cluster
                  </li>
                )}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {credentials?.ttn_region && credentials.ttn_region !== "nam1" && (
            <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg border border-warning/30">
              <MapPin className="h-4 w-4 text-warning" />
              <span className="text-sm">
                <strong>Region Migration:</strong> {credentials.ttn_region.toUpperCase()} → NAM1
              </span>
            </div>
          )}

          <div className="flex items-start gap-3 py-4">
            <Checkbox
              id="confirm-start-fresh"
              checked={confirmChecked}
              onCheckedChange={(checked) => setConfirmChecked(checked === true)}
            />
            <label
              htmlFor="confirm-start-fresh"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              I understand this action cannot be undone and may cause temporary service interruption
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmChecked(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStartFreshWithConfirm}
              disabled={!confirmChecked || isStartingFresh}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {isStartingFresh ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Starting Fresh...
                </>
              ) : (
                credentials?.ttn_region && credentials.ttn_region !== "nam1" 
                  ? "Migrate to NAM1"
                  : "Start Fresh"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deep Clean Confirmation Dialog */}
      <AlertDialog open={showDeepCleanDialog} onOpenChange={setShowDeepCleanDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-alarm">
              <Trash2 className="h-5 w-5" />
              Deep Clean TTN Resources?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="text-alarm font-medium">
                This is a destructive action that will permanently delete ALL TTN resources.
              </p>
              <p>This will:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Delete ALL devices from the TTN application</li>
                <li>Delete the TTN Application itself</li>
                <li>Delete the TTN Organization</li>
                <li>Reset ALL sensors to 'pending' status</li>
                <li>Clear ALL stored credentials</li>
              </ul>
              <p className="text-sm mt-2">
                After this, you will need to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Click "Start Provisioning" to create new TTN resources on <strong>NAM1</strong></li>
                <li>Re-provision all your sensors</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-start gap-3 py-4 border-y border-alarm/30 bg-alarm/5 -mx-6 px-6">
            <Checkbox
              id="confirm-deep-clean"
              checked={deepCleanConfirmChecked}
              onCheckedChange={(checked) => setDeepCleanConfirmChecked(checked === true)}
            />
            <label
              htmlFor="confirm-deep-clean"
              className="text-sm cursor-pointer"
            >
              I understand this will <strong>permanently delete</strong> all TTN resources and I will need to re-provision all sensors
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeepCleanConfirmChecked(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeepClean}
              disabled={!deepCleanConfirmChecked || isDeepCleaning}
              className="bg-alarm text-alarm-foreground hover:bg-alarm/90"
            >
              {isDeepCleaning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deep Cleaning...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Deep Clean & Reset
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
