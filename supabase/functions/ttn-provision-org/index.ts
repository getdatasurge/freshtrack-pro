/**
 * TTN Organization Provisioning Edge Function
 * 
 * Creates a complete TTN application infrastructure for an organization:
 * - Creates TTN Application (freshtracker-{org-slug})
 * - Creates application-scoped API key with required permissions
 * - Creates webhook pointing to our ttn-webhook endpoint
 * - Saves all credentials to ttn_connections table
 * 
 * Security:
 * - Requires admin/owner role in the organization
 * - Uses TTN_ADMIN_API_KEY for creating applications (platform-level key)
 * - Generates unique webhook secret per organization
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateTtnApplicationId,
  generateWebhookSecret,
  obfuscateKey,
  getLast4,
} from "../_shared/ttnConfig.ts";
import {
  APPLICATION_KEY_RIGHTS,
  GATEWAY_KEY_RIGHTS,
} from "../_shared/ttnPermissions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProvisionOrgRequest {
  action: "provision" | "status" | "delete" | "regenerate_webhook_secret" | "retry";
  organization_id: string;
  ttn_region?: string;
  from_step?: string; // For retry action
}

const REGIONAL_URLS: Record<string, string> = {
  nam1: "https://nam1.cloud.thethings.network",
  eu1: "https://eu1.cloud.thethings.network",
  au1: "https://au1.cloud.thethings.network",
  as1: "https://as1.cloud.thethings.network",
};

const IDENTITY_SERVER_URL = "https://eu1.cloud.thethings.network";

// Frequency plan mapping by region
const FREQUENCY_PLANS: Record<string, string> = {
  nam1: "US_902_928_FSB_2",
  eu1: "EU_863_870_TTN",
  au1: "AU_915_928_FSB_2",
  as1: "AS_923_925_LBT",
};

// Request timeout in milliseconds
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
  url: string, 
  options: RequestInit, 
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Error category classification
type ErrorCategory = 'credential_missing' | 'credential_invalid' | 'permission_denied' | 'network_error' | 'timeout' | 'ttn_error' | 'internal';

function classifyError(error: unknown, httpStatus?: number): ErrorCategory {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('aborted')) {
    return 'timeout';
  }
  if (msg.includes('network') || msg.includes('fetch failed') || msg.includes('dns') || msg.includes('enotfound')) {
    return 'network_error';
  }
  if (httpStatus === 401) {
    return 'credential_invalid';
  }
  if (httpStatus === 403) {
    return 'permission_denied';
  }
  if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
    return 'ttn_error';
  }
  if (httpStatus && httpStatus >= 500) {
    return 'ttn_error';
  }
  return 'internal';
}

function getErrorHint(category: ErrorCategory): string {
  switch (category) {
    case 'credential_missing':
      return 'TTN admin credentials are not configured. Contact your administrator.';
    case 'credential_invalid':
      return 'TTN API key is invalid or expired. Verify the TTN_ADMIN_API_KEY secret.';
    case 'permission_denied':
      return 'TTN API key lacks required permissions. Ensure it has application creation rights.';
    case 'network_error':
      return 'Could not connect to TTN servers. Check network connectivity.';
    case 'timeout':
      return 'TTN is responding slowly. Try again in a few minutes.';
    case 'ttn_error':
      return 'TTN rejected the request. Check the error details.';
    case 'internal':
    default:
      return 'An unexpected error occurred. Contact support if the problem persists.';
  }
}

/**
 * Log a provisioning step to the database with enhanced diagnostics
 */
async function logProvisioningStep(
  supabase: SupabaseClient,
  organizationId: string,
  step: string,
  status: 'started' | 'success' | 'failed' | 'skipped',
  message: string,
  payload?: Record<string, unknown>,
  durationMs?: number,
  requestId?: string,
  ttnHttpStatus?: number,
  ttnResponseBody?: string,
  errorCategory?: ErrorCategory,
  ttnEndpoint?: string
): Promise<void> {
  try {
    await supabase.from("ttn_provisioning_logs").insert({
      organization_id: organizationId,
      step,
      status,
      message,
      payload: payload || null,
      duration_ms: durationMs || null,
      request_id: requestId || null,
      ttn_http_status: ttnHttpStatus || null,
      ttn_response_body: ttnResponseBody?.slice(0, 2000) || null, // Truncate large responses
      error_category: errorCategory || null,
      ttn_endpoint: ttnEndpoint || null,
    });
  } catch (err) {
    console.error(`[ttn-provision-org] Failed to log step ${step}:`, err);
  }
}

/**
 * Sanitize HTTP response body - truncate and redact secrets
 */
function sanitizeHttpBody(body: string | null, maxLength: number = 500): string | null {
  if (!body) return null;
  let sanitized = body;
  // Redact potential secrets
  sanitized = sanitized.replace(/"(key|api_key|secret|token|password)":\s*"[^"]+"/gi, '"$1":"[REDACTED]"');
  sanitized = sanitized.replace(/Bearer\s+[^\s"]+/gi, 'Bearer [REDACTED]');
  // Truncate
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + '...[truncated]';
  }
  return sanitized;
}

/**
 * Update provisioning status with step info and heartbeat (new unified model)
 */
async function updateProvisioningState(
  supabase: SupabaseClient,
  organizationId: string,
  patch: {
    status?: 'idle' | 'provisioning' | 'ready' | 'failed';
    step?: string;
    error?: string | null;
    last_http_status?: number | null;
    last_http_body?: string | null;
    increment_attempt?: boolean;
    clear_error?: boolean;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {
    provisioning_last_heartbeat_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  if (patch.status) {
    updateData.provisioning_status = patch.status;
  }
  if (patch.step !== undefined) {
    updateData.provisioning_step = patch.step;
    updateData.provisioning_last_step = patch.step; // Keep legacy field in sync
  }
  if (patch.error !== undefined) {
    updateData.provisioning_error = patch.error;
    if (patch.error) {
      updateData.provisioning_can_retry = true;
    }
  }
  if (patch.clear_error) {
    updateData.provisioning_error = null;
  }
  if (patch.last_http_status !== undefined) {
    updateData.last_http_status = patch.last_http_status;
  }
  if (patch.last_http_body !== undefined) {
    updateData.last_http_body = sanitizeHttpBody(patch.last_http_body);
  }
  if (patch.increment_attempt) {
    // Use raw SQL for atomic increment
    const { data: current } = await supabase
      .from("ttn_connections")
      .select("provisioning_attempt_count")
      .eq("organization_id", organizationId)
      .single();
    updateData.provisioning_attempt_count = (current?.provisioning_attempt_count || 0) + 1;
    updateData.provisioning_started_at = new Date().toISOString();
  }
  
  await supabase
    .from("ttn_connections")
    .update(updateData)
    .eq("organization_id", organizationId);
}

/**
 * Check for and auto-fail stale provisioning rows
 */
async function checkAndFailStale(
  supabase: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from("ttn_connections")
    .select("provisioning_status, provisioning_last_heartbeat_at, provisioning_step")
    .eq("organization_id", organizationId)
    .single();
  
  if (error || !data) return false;
  
  if (
    data.provisioning_status === 'provisioning' &&
    (!data.provisioning_last_heartbeat_at || data.provisioning_last_heartbeat_at < twoMinutesAgo)
  ) {
    await updateProvisioningState(supabase, organizationId, {
      status: 'failed',
      step: data.provisioning_step || 'unknown',
      error: 'Provisioning stalled (no heartbeat for 2+ minutes). Safe to retry.',
    });
    return true;
  }
  
  return false;
}

/**
 * Legacy wrapper for backward compatibility
 */
async function updateProvisioningStatus(
  supabase: SupabaseClient,
  organizationId: string,
  status: string,
  currentStep: string,
  error?: string,
  stepDetails?: Record<string, unknown>
): Promise<void> {
  // Map legacy status values to new state machine
  let mappedStatus: 'idle' | 'provisioning' | 'ready' | 'failed' = 'provisioning';
  if (status === 'completed') mappedStatus = 'ready';
  else if (status === 'failed') mappedStatus = 'failed';
  else if (status === 'not_started' || status === 'idle') mappedStatus = 'idle';
  else if (status === 'provisioning') mappedStatus = 'provisioning';
  
  await updateProvisioningState(supabase, organizationId, {
    status: mappedStatus,
    step: currentStep,
    error: error || null,
  });
  
  // Also update legacy step_details field
  if (stepDetails) {
    await supabase
      .from("ttn_connections")
      .update({
        provisioning_step_details: stepDetails,
        provisioning_can_retry: status === 'failed',
        last_provisioning_attempt_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);
  }
}

serve(async (req) => {
  const BUILD_VERSION = "ttn-provision-org-v1.2-timeout-logging-20260103";
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[ttn-provision-org] [${requestId}] Build: ${BUILD_VERSION}`);
  console.log(`[ttn-provision-org] [${requestId}] Method: ${req.method}, URL: ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (req.method === "GET") {
    const hasTtnAdminKey = !!Deno.env.get("TTN_ADMIN_API_KEY");
    const hasTtnUserId = !!Deno.env.get("TTN_USER_ID");
    
    return new Response(
      JSON.stringify({
        status: "ok",
        function: "ttn-provision-org",
        version: BUILD_VERSION,
        timestamp: new Date().toISOString(),
        request_id: requestId,
        environment: {
          hasSupabaseUrl: !!Deno.env.get("SUPABASE_URL"),
          hasServiceKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
          hasTtnAdminKey,
          hasTtnUserId,
          ready: hasTtnAdminKey && hasTtnUserId,
        },
        capabilities: {
          timeout_ms: REQUEST_TIMEOUT_MS,
          max_retries: MAX_RETRIES,
          provisioning_logs: true,
          retry_support: true,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ttnAdminKey = Deno.env.get("TTN_ADMIN_API_KEY");
    const ttnUserId = Deno.env.get("TTN_USER_ID");
    const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") || supabaseServiceKey?.slice(0, 32) || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Supabase credentials", request_id: requestId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ttnAdminKey || !ttnUserId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "TTN admin credentials not configured",
          hint: "Contact your administrator to set up TTN_ADMIN_API_KEY and TTN_USER_ID secrets",
          request_id: requestId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user session", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: ProvisionOrgRequest = await req.json();
    const { action, organization_id, ttn_region, from_step } = body;
    const region = (ttn_region || "nam1").toLowerCase();

    console.log(`[ttn-provision-org] [${requestId}] Action: ${action}, Org: ${organization_id}, Region: ${region}`);

    // Verify user is admin/owner
    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (!roleCheck || !["owner", "admin"].includes(roleCheck.role)) {
      return new Response(
        JSON.stringify({ error: "Only admins and owners can manage TTN provisioning", request_id: requestId }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", organization_id)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: "Organization not found", request_id: requestId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create ttn_connections record
    let { data: ttnConn } = await supabase
      .from("ttn_connections")
      .select("*")
      .eq("organization_id", organization_id)
      .maybeSingle();

    // ========================================
    // ACTION: STATUS - Get current provisioning status (with stale detection)
    // ========================================
    if (action === "status") {
      // Auto-fail stale provisioning
      const wasStale = await checkAndFailStale(supabase, organization_id);
      if (wasStale) {
        console.log(`[ttn-provision-org] [${requestId}] Auto-failed stale provisioning for org ${organization_id}`);
        // Refresh ttnConn after auto-fail
        const { data: refreshed } = await supabase
          .from("ttn_connections")
          .select("*")
          .eq("organization_id", organization_id)
          .maybeSingle();
        ttnConn = refreshed;
      }
      
      // Map legacy status values for response
      let statusValue = ttnConn?.provisioning_status || "idle";
      if (statusValue === "not_started") statusValue = "idle";
      if (statusValue === "completed") statusValue = "ready";
      
      return new Response(
        JSON.stringify({
          success: true,
          request_id: requestId,
          provisioning_status: statusValue,
          provisioning_step: ttnConn?.provisioning_step || ttnConn?.provisioning_last_step || null,
          provisioning_started_at: ttnConn?.provisioning_started_at || null,
          provisioning_last_heartbeat_at: ttnConn?.provisioning_last_heartbeat_at || null,
          provisioning_attempt_count: ttnConn?.provisioning_attempt_count || 0,
          provisioning_can_retry: ttnConn?.provisioning_can_retry ?? true,
          provisioning_error: ttnConn?.provisioning_error || null,
          last_http_status: ttnConn?.last_http_status || null,
          last_http_body: ttnConn?.last_http_body || null,
          ttn_application_id: ttnConn?.ttn_application_id || null,
          ttn_region: ttnConn?.ttn_region || "nam1",
          has_api_key: !!ttnConn?.ttn_api_key_encrypted,
          has_webhook_secret: !!ttnConn?.ttn_webhook_secret_encrypted,
          webhook_url: ttnConn?.ttn_webhook_url || null,
          provisioned_at: ttnConn?.ttn_application_provisioned_at || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // ACTION: REGENERATE_WEBHOOK_SECRET
    // ========================================
    if (action === "regenerate_webhook_secret") {
      if (!ttnConn?.ttn_application_id) {
        return new Response(
          JSON.stringify({ error: "TTN application not provisioned yet", request_id: requestId }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newSecret = generateWebhookSecret();
      const encryptedSecret = obfuscateKey(newSecret, encryptionSalt);
      
      // Ensure absolute webhook URL
      const webhookUrl = supabaseUrl.startsWith('http') 
        ? `${supabaseUrl}/functions/v1/ttn-webhook`
        : `https://${supabaseUrl}/functions/v1/ttn-webhook`;
      const regionalUrl = REGIONAL_URLS[region] || REGIONAL_URLS.nam1;
      
      try {
        const updateWebhookResponse = await fetchWithTimeout(
          `${regionalUrl}/api/v3/as/webhooks/${ttnConn.ttn_application_id}/freshtracker`,
          {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${ttnAdminKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              webhook: {
                ids: {
                  webhook_id: "freshtracker",
                  application_ids: { application_id: ttnConn.ttn_application_id },
                },
                base_url: webhookUrl,
                headers: {
                  "X-Webhook-Secret": newSecret,
                },
              },
              field_mask: {
                paths: ["headers", "base_url", "format", "uplink_message", "join_accept"],
              },
            }),
          }
        );

        if (!updateWebhookResponse.ok) {
          const errorText = await updateWebhookResponse.text();
          console.error(`[ttn-provision-org] [${requestId}] Failed to update webhook: ${errorText}`);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to update webhook in TTN", details: errorText, request_id: requestId }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Save new secret to database
        await supabase
          .from("ttn_connections")
          .update({
            ttn_webhook_secret_encrypted: encryptedSecret,
            ttn_webhook_secret_last4: getLast4(newSecret),
            updated_by: user.id,
          })
          .eq("id", ttnConn.id);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Webhook secret regenerated",
            webhook_secret_last4: getLast4(newSecret),
            request_id: requestId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`[ttn-provision-org] [${requestId}] Regenerate webhook failed:`, err);
        return new Response(
          JSON.stringify({ success: false, error: errorMessage, request_id: requestId }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========================================
    // ACTION: PROVISION or RETRY - Create TTN application for org
    // ========================================
    if (action === "provision" || action === "retry") {
      // Auto-fail stale provisioning before starting
      await checkAndFailStale(supabase, organization_id);
      
      // Refresh ttnConn after potential stale check
      const { data: refreshedConn } = await supabase
        .from("ttn_connections")
        .select("*")
        .eq("organization_id", organization_id)
        .maybeSingle();
      ttnConn = refreshedConn;
      
      // Check if already provisioned (only for fresh provision)
      if (action === "provision" && ttnConn?.ttn_application_id && 
          (ttnConn.provisioning_status === "completed" || ttnConn.provisioning_status === "ready")) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "TTN application already provisioned",
            ttn_application_id: ttnConn.ttn_application_id,
            provisioning_status: "ready",
            request_id: requestId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate TTN application ID from org UUID (fg-{first8chars})
      const ttnAppId = generateTtnApplicationId(org.id);
      console.log(`[ttn-provision-org] [${requestId}] Provisioning TTN app: ${ttnAppId} for org ${org.slug}`);

      // Determine which steps to run based on retry
      const skipToStep = action === "retry" ? from_step : null;
      const completedSteps: Record<string, unknown> = ttnConn?.provisioning_step_details || {};

      // Initialize or update ttn_connections record with new state fields
      if (ttnConn) {
        await updateProvisioningState(supabase, organization_id, {
          status: 'provisioning',
          step: 'init',
          clear_error: true,
          increment_attempt: true,
          last_http_status: null,
          last_http_body: null,
        });
        await supabase
          .from("ttn_connections")
          .update({
            ttn_region: region,
            updated_by: user.id,
            provisioning_can_retry: false,
          })
          .eq("id", ttnConn.id);
      } else {
        const { data: newConn } = await supabase
          .from("ttn_connections")
          .insert({
            organization_id: organization_id,
            ttn_region: region,
            provisioning_status: "provisioning",
            provisioning_step: "init",
            provisioning_started_at: new Date().toISOString(),
            provisioning_last_heartbeat_at: new Date().toISOString(),
            provisioning_attempt_count: 1,
            created_by: user.id,
          })
          .select()
          .single();
        ttnConn = newConn;
      }

      // Ensure absolute webhook URL
      const webhookUrl = supabaseUrl.startsWith('http') 
        ? `${supabaseUrl}/functions/v1/ttn-webhook`
        : `https://${supabaseUrl}/functions/v1/ttn-webhook`;
      const regionalUrl = REGIONAL_URLS[region] || REGIONAL_URLS.nam1;

      let newApiKey = "";
      let apiKeyId = "";
      let gatewayApiKey = "";
      let gatewayApiKeyId = "";
      let webhookSecret = "";
      let webhookCreated = false;

      try {
// ============ STEP 0: Preflight - Verify admin key has rights ============
        const step0Start = Date.now();
        if (!completedSteps.preflight_done) {
          await logProvisioningStep(supabase, organization_id, "preflight", "started", "Verifying TTN admin credentials", undefined, undefined, requestId);
          await updateProvisioningState(supabase, organization_id, { step: "preflight" });
          
          console.log(`[ttn-provision-org] [${requestId}] Step 0: Preflight check for admin key`);
          
          // Test that the admin key can access the identity server
          try {
            const authInfoResponse = await fetchWithTimeout(
              `${IDENTITY_SERVER_URL}/api/v3/auth_info`,
              {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${ttnAdminKey}`,
                  "Accept": "application/json",
                },
              }
            );
            
            if (!authInfoResponse.ok) {
              const errorText = await authInfoResponse.text();
              const duration = Date.now() - step0Start;
              await logProvisioningStep(supabase, organization_id, "preflight", "failed", `Admin key validation failed: HTTP ${authInfoResponse.status}`, { status: authInfoResponse.status }, duration, requestId, authInfoResponse.status, errorText, "credential_invalid");
              await updateProvisioningState(supabase, organization_id, {
                status: 'failed',
                error: `TTN admin key is invalid or expired (HTTP ${authInfoResponse.status}). Contact your administrator.`,
                last_http_status: authInfoResponse.status,
                last_http_body: errorText,
              });
              throw new Error(`TTN admin key validation failed: ${authInfoResponse.status}`);
            }
            
            const authInfo = await authInfoResponse.json();
            console.log(`[ttn-provision-org] [${requestId}] Preflight: Admin key valid, principal: ${authInfo.universal_rights ? 'admin' : 'user'}`);
            
            const duration = Date.now() - step0Start;
            await logProvisioningStep(supabase, organization_id, "preflight", "success", "Admin credentials verified", { has_universal_rights: !!authInfo.universal_rights }, duration, requestId);
            completedSteps.preflight_done = true;
            
            await supabase
              .from("ttn_connections")
              .update({ provisioning_step_details: completedSteps })
              .eq("organization_id", organization_id);
          } catch (preflightErr) {
            if ((preflightErr as Error).message.includes("validation failed")) {
              throw preflightErr; // Re-throw credential errors
            }
            const duration = Date.now() - step0Start;
            const errMsg = preflightErr instanceof Error ? preflightErr.message : "Preflight check failed";
            await logProvisioningStep(supabase, organization_id, "preflight", "failed", errMsg, { error: errMsg }, duration, requestId, undefined, undefined, "network_error");
            throw preflightErr;
          }
        }

        // ============ STEP 1: Create TTN Application ============
        const step1Start = Date.now();
        const shouldRunStep1 = !skipToStep || skipToStep === "create_application" || !completedSteps.application_created;
        
        if (shouldRunStep1 && !completedSteps.application_created) {
          const ttnEndpoint = `${IDENTITY_SERVER_URL}/api/v3/users/${ttnUserId}/applications`;
          await logProvisioningStep(supabase, organization_id, "create_application", "started", "Creating TTN application", { ttn_app_id: ttnAppId, endpoint: ttnEndpoint }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "create_ttn_app" });
          
          console.log(`[ttn-provision-org] [${requestId}] Step 1: Creating TTN application ${ttnAppId}`);
          
          let createAppResponse: Response;
          try {
            createAppResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${ttnAdminKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  application: {
                    ids: { application_id: ttnAppId },
                    name: `FreshTracker - ${org.name}`,
                    description: `FreshTracker temperature monitoring for ${org.name}`,
                  },
                }),
              }
            );
          } catch (fetchErr) {
            const duration = Date.now() - step1Start;
            const category = classifyError(fetchErr);
            const errMsg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed";
            await logProvisioningStep(supabase, organization_id, "create_application", "failed", errMsg, { error: errMsg }, duration, requestId, undefined, undefined, category, ttnEndpoint);
            throw fetchErr;
          }

          if (!createAppResponse.ok && createAppResponse.status !== 409) {
            const errorText = await createAppResponse.text();
            const duration = Date.now() - step1Start;
            const category = classifyError(errorText, createAppResponse.status);
            await logProvisioningStep(supabase, organization_id, "create_application", "failed", `HTTP ${createAppResponse.status}`, { status: createAppResponse.status }, duration, requestId, createAppResponse.status, errorText, category, ttnEndpoint);
            throw new Error(`Failed to create application: ${createAppResponse.status} - ${errorText}`);
          }

          const duration = Date.now() - step1Start;
          await logProvisioningStep(supabase, organization_id, "create_application", "success", "TTN application created", { ttn_app_id: ttnAppId }, duration, requestId, createAppResponse.status, undefined, undefined, ttnEndpoint);
          completedSteps.application_created = true;
          
          // Save progress immediately
          await supabase
            .from("ttn_connections")
            .update({
              ttn_application_id: ttnAppId,
              ttn_application_name: `FreshTracker - ${org.name}`,
              provisioning_step_details: completedSteps,
            })
            .eq("organization_id", organization_id);
        } else {
          console.log(`[ttn-provision-org] [${requestId}] Step 1: Skipping (already completed)`);
        }

        // ============ STEP 2: Create Application API Key ============
        const step2Start = Date.now();
        const shouldRunStep2 = !skipToStep || skipToStep === "create_api_key" || 
                              (skipToStep === "create_application" && completedSteps.application_created) ||
                              !completedSteps.api_key_created;

        if (shouldRunStep2 && !completedSteps.api_key_created) {
          const ttnEndpoint = `${IDENTITY_SERVER_URL}/api/v3/applications/${ttnAppId}/api-keys`;
          await logProvisioningStep(supabase, organization_id, "create_api_key", "started", "Creating application API key", { endpoint: ttnEndpoint }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "create_api_key" });
          
          console.log(`[ttn-provision-org] [${requestId}] Step 2: Creating application API key for ${ttnAppId}`);

          let createKeyResponse: Response;
          try {
            createKeyResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${ttnAdminKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: "FreshTracker Integration",
                  rights: APPLICATION_KEY_RIGHTS,
                }),
              }
            );
          } catch (fetchErr) {
            const duration = Date.now() - step2Start;
            const category = classifyError(fetchErr);
            const errMsg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed";
            await logProvisioningStep(supabase, organization_id, "create_api_key", "failed", errMsg, { error: errMsg }, duration, requestId, undefined, undefined, category, ttnEndpoint);
            throw fetchErr;
          }

          if (!createKeyResponse.ok) {
            const errorText = await createKeyResponse.text();
            const duration = Date.now() - step2Start;
            const category = classifyError(errorText, createKeyResponse.status);
            
            // Enhanced error messaging for 403
            let errorDetail = `HTTP ${createKeyResponse.status}`;
            let userHint = "";
            if (createKeyResponse.status === 403) {
              userHint = "The TTN admin key does not have permission to create API keys for this application. " +
                "This can happen if the admin key was created before the application, or if TTN requires the user to be a collaborator. " +
                "Try manually adding an API key in TTN Console.";
              errorDetail = "Permission denied - admin key lacks application rights";
            }
            
            await logProvisioningStep(supabase, organization_id, "create_api_key", "failed", errorDetail, { 
              status: createKeyResponse.status,
              hint: userHint,
            }, duration, requestId, createKeyResponse.status, errorText, category, ttnEndpoint);
            
            // Store detailed error state
            await updateProvisioningState(supabase, organization_id, {
              status: 'failed',
              error: userHint || `Failed to create application API key: ${createKeyResponse.status}`,
              last_http_status: createKeyResponse.status,
              last_http_body: errorText,
            });
            
            throw new Error(`Failed to create application API key: ${createKeyResponse.status} - ${errorText}`);
          }

          const keyData = await createKeyResponse.json();
          newApiKey = keyData.key;
          apiKeyId = keyData.id;

          const duration = Date.now() - step2Start;
          await logProvisioningStep(supabase, organization_id, "create_api_key", "success", "Application API key created", { key_last4: getLast4(newApiKey) }, duration, requestId, createKeyResponse.status, undefined, undefined, ttnEndpoint);
          completedSteps.api_key_created = true;

          // Save API key immediately
          const encryptedApiKey = obfuscateKey(newApiKey, encryptionSalt);
          await supabase
            .from("ttn_connections")
            .update({
              ttn_api_key_encrypted: encryptedApiKey,
              ttn_api_key_last4: getLast4(newApiKey),
              ttn_api_key_id: apiKeyId,
              ttn_api_key_updated_at: new Date().toISOString(),
              provisioning_step_details: completedSteps,
            })
            .eq("organization_id", organization_id);
        } else {
          console.log(`[ttn-provision-org] [${requestId}] Step 2: Skipping (already completed)`);
        }

        // ============ STEP 2b: Create Gateway API Key (optional) ============
        const step2bStart = Date.now();
        if (!completedSteps.gateway_key_attempted) {
          await logProvisioningStep(supabase, organization_id, "create_gateway_key", "started", "Creating gateway API key", undefined, undefined, requestId);
          console.log(`[ttn-provision-org] [${requestId}] Step 2b: Creating gateway API key for user ${ttnUserId}`);

          try {
            const createGatewayKeyResponse = await fetchWithTimeout(
              `${IDENTITY_SERVER_URL}/api/v3/users/${ttnUserId}/api-keys`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${ttnAdminKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: `FreshTracker Gateway - ${org.slug}`,
                  rights: GATEWAY_KEY_RIGHTS,
                }),
              }
            );

            if (createGatewayKeyResponse.ok) {
              const gatewayKeyData = await createGatewayKeyResponse.json();
              gatewayApiKey = gatewayKeyData.key;
              gatewayApiKeyId = gatewayKeyData.id;
              
              const duration = Date.now() - step2bStart;
              await logProvisioningStep(supabase, organization_id, "create_gateway_key", "success", "Gateway API key created", { key_last4: getLast4(gatewayApiKey) }, duration, requestId);
              completedSteps.gateway_key_created = true;

              // Save gateway key immediately
              const encryptedGatewayKey = obfuscateKey(gatewayApiKey, encryptionSalt);
              await supabase
                .from("ttn_connections")
                .update({
                  ttn_gateway_api_key_encrypted: encryptedGatewayKey,
                  ttn_gateway_api_key_last4: getLast4(gatewayApiKey),
                  ttn_gateway_api_key_id: gatewayApiKeyId,
                  ttn_gateway_rights_verified: true,
                })
                .eq("organization_id", organization_id);
            } else {
              const errorText = await createGatewayKeyResponse.text();
              const duration = Date.now() - step2bStart;
              await logProvisioningStep(supabase, organization_id, "create_gateway_key", "skipped", `Gateway key creation failed (non-blocking): ${errorText}`, { status: createGatewayKeyResponse.status }, duration, requestId);
              console.warn(`[ttn-provision-org] [${requestId}] Warning: Failed to create gateway API key - will fall back to admin key`);
            }
          } catch (gatewayErr) {
            const duration = Date.now() - step2bStart;
            const errMsg = gatewayErr instanceof Error ? gatewayErr.message : "Unknown error";
            await logProvisioningStep(supabase, organization_id, "create_gateway_key", "skipped", `Gateway key creation failed (non-blocking): ${errMsg}`, undefined, duration, requestId);
            console.warn(`[ttn-provision-org] [${requestId}] Warning: Gateway key creation timed out - will fall back to admin key`);
          }
          
          completedSteps.gateway_key_attempted = true;
          await supabase
            .from("ttn_connections")
            .update({ provisioning_step_details: completedSteps })
            .eq("organization_id", organization_id);
        }

        // ============ STEP 3: Create Webhook ============
        const step3Start = Date.now();
        const shouldRunStep3 = !completedSteps.webhook_created;

        if (shouldRunStep3) {
          await logProvisioningStep(supabase, organization_id, "create_webhook", "started", "Creating TTN webhook", { webhook_url: webhookUrl }, undefined, requestId);
          await updateProvisioningState(supabase, organization_id, { step: "create_webhook" });
          
          console.log(`[ttn-provision-org] [${requestId}] Step 3: Creating webhook for ${ttnAppId}`);
          
          webhookSecret = generateWebhookSecret();
          
          // Use the API key we just created (or try to get from DB if retry)
          let apiKeyToUse = newApiKey;
          if (!apiKeyToUse && ttnConn?.ttn_api_key_encrypted) {
            // For retry, we'd need to decrypt - for now use admin key
            apiKeyToUse = ttnAdminKey;
          }

          // Try POST first, then PUT if exists
          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
              const createWebhookResponse = await fetchWithTimeout(
                `${regionalUrl}/api/v3/as/webhooks/${ttnAppId}`,
                {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${apiKeyToUse}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    webhook: {
                      ids: {
                        webhook_id: "freshtracker",
                        application_ids: { application_id: ttnAppId },
                      },
                      base_url: webhookUrl,
                      format: "json",
                      headers: { "X-Webhook-Secret": webhookSecret },
                      uplink_message: {},
                      join_accept: {},
                    },
                  }),
                }
              );

              if (createWebhookResponse.ok) {
                webhookCreated = true;
                console.log(`[ttn-provision-org] [${requestId}] Webhook created successfully`);
                break;
              } else if (createWebhookResponse.status === 409) {
                // Webhook exists, try PUT to update
                console.log(`[ttn-provision-org] [${requestId}] Webhook exists, updating...`);
                const updateResponse = await fetchWithTimeout(
                  `${regionalUrl}/api/v3/as/webhooks/${ttnAppId}/freshtracker`,
                  {
                    method: "PUT",
                    headers: {
                      "Authorization": `Bearer ${apiKeyToUse}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      webhook: {
                        ids: {
                          webhook_id: "freshtracker",
                          application_ids: { application_id: ttnAppId },
                        },
                        base_url: webhookUrl,
                        format: "json",
                        headers: { "X-Webhook-Secret": webhookSecret },
                        uplink_message: {},
                        join_accept: {},
                      },
                      field_mask: {
                        paths: ["headers", "base_url", "format", "uplink_message", "join_accept"],
                      },
                    }),
                  }
                );
                if (updateResponse.ok) {
                  webhookCreated = true;
                  console.log(`[ttn-provision-org] [${requestId}] Webhook updated successfully`);
                  break;
                } else {
                  const updateError = await updateResponse.text();
                  console.warn(`[ttn-provision-org] [${requestId}] Webhook update failed: ${updateError}`);
                }
              } else {
                const errorText = await createWebhookResponse.text();
                console.warn(`[ttn-provision-org] [${requestId}] Webhook creation attempt ${attempt + 1} failed: ${errorText}`);
              }

              if (attempt < MAX_RETRIES - 1) {
                await new Promise(r => setTimeout(r, 500 * (attempt + 1))); // Backoff
              }
            } catch (webhookErr) {
              const errMsg = webhookErr instanceof Error ? webhookErr.message : "Unknown error";
              console.warn(`[ttn-provision-org] [${requestId}] Webhook attempt ${attempt + 1} error: ${errMsg}`);
              if (attempt < MAX_RETRIES - 1) {
                await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
              }
            }
          }

          const duration = Date.now() - step3Start;
          if (webhookCreated) {
            await logProvisioningStep(supabase, organization_id, "create_webhook", "success", "Webhook configured", { webhook_url: webhookUrl }, duration, requestId);
            completedSteps.webhook_created = true;

            // Save webhook credentials
            const encryptedWebhookSecret = obfuscateKey(webhookSecret, encryptionSalt);
            await supabase
              .from("ttn_connections")
              .update({
                ttn_webhook_secret_encrypted: encryptedWebhookSecret,
                ttn_webhook_secret_last4: getLast4(webhookSecret),
                ttn_webhook_url: webhookUrl,
                ttn_webhook_id: "freshtracker",
                provisioning_step_details: completedSteps,
              })
              .eq("organization_id", organization_id);
          } else {
            await logProvisioningStep(supabase, organization_id, "create_webhook", "failed", "Webhook creation failed after retries", undefined, duration, requestId);
            console.warn(`[ttn-provision-org] [${requestId}] Webhook creation failed - will need manual setup`);
          }
        }

        // ============ STEP 4: Finalize ============
        console.log(`[ttn-provision-org] [${requestId}] Step 4: Finalizing provisioning`);

        // Use new state machine: 'ready' instead of 'completed'
        await updateProvisioningState(supabase, organization_id, {
          status: 'ready',
          step: 'complete',
          error: null,
        });
        
        await supabase
          .from("ttn_connections")
          .update({
            provisioning_can_retry: false,
            ttn_application_provisioned_at: new Date().toISOString(),
            is_enabled: true,
            updated_by: user.id,
          })
          .eq("organization_id", organization_id);

        // Log success event
        await supabase.from("event_logs").insert({
          organization_id: organization_id,
          event_type: "ttn.application.provisioned",
          category: "settings",
          severity: "info",
          title: "TTN Application Provisioned",
          actor_id: user.id,
          event_data: {
            ttn_application_id: ttnAppId,
            region,
            webhook_url: webhookUrl,
            webhook_created: webhookCreated,
            request_id: requestId,
          },
        });

        await logProvisioningStep(supabase, organization_id, "complete", "success", "Provisioning completed", { 
          ttn_app_id: ttnAppId, 
          webhook_created: webhookCreated 
        }, undefined, requestId);

        console.log(`[ttn-provision-org] [${requestId}] Provisioning complete for ${ttnAppId}`);

        return new Response(
          JSON.stringify({
            success: true,
            ttn_application_id: ttnAppId,
            provisioning_status: "completed",
            webhook_url: webhookUrl,
            webhook_created: webhookCreated,
            api_key_last4: newApiKey ? getLast4(newApiKey) : ttnConn?.ttn_api_key_last4,
            webhook_secret_last4: webhookSecret ? getLast4(webhookSecret) : null,
            gateway_key_created: !!gatewayApiKey,
            gateway_key_last4: gatewayApiKey ? getLast4(gatewayApiKey) : null,
            request_id: requestId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (provisionError) {
        const errorMessage = provisionError instanceof Error ? provisionError.message : "Unknown error";
        console.error(`[ttn-provision-org] [${requestId}] Provisioning failed:`, provisionError);

        // Determine retryable and which step failed
        const isTimeout = errorMessage.includes("timed out");
        const isRetryable = isTimeout || errorMessage.includes("network") || errorMessage.includes("fetch");

        // Save error to database
        await supabase
          .from("ttn_connections")
          .update({
            provisioning_status: "failed",
            provisioning_error: errorMessage,
            provisioning_can_retry: isRetryable,
            provisioning_step_details: completedSteps,
          })
          .eq("organization_id", organization_id);

        await logProvisioningStep(supabase, organization_id, "error", "failed", errorMessage, { retryable: isRetryable }, undefined, requestId);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Provisioning failed",
            message: errorMessage,
            details: errorMessage,
            provisioning_status: "failed",
            retryable: isRetryable,
            completed_steps: completedSteps,
            request_id: requestId,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========================================
    // ACTION: DELETE - Remove TTN application
    // ========================================
    if (action === "delete") {
      if (!ttnConn?.ttn_application_id) {
        return new Response(
          JSON.stringify({ success: true, message: "No TTN application to delete", request_id: requestId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        await logProvisioningStep(supabase, organization_id, "delete_application", "started", "Deleting TTN application", { ttn_app_id: ttnConn.ttn_application_id }, undefined, requestId);

        // Delete the TTN application (this also deletes all devices and webhooks)
        const deleteResponse = await fetchWithTimeout(
          `${IDENTITY_SERVER_URL}/api/v3/applications/${ttnConn.ttn_application_id}`,
          {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${ttnAdminKey}`,
            },
          }
        );

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          const errorText = await deleteResponse.text();
          throw new Error(`Failed to delete application: ${deleteResponse.status} - ${errorText}`);
        }

        // Clear TTN settings
        await supabase
          .from("ttn_connections")
          .update({
            ttn_application_id: null,
            ttn_application_name: null,
            ttn_api_key_encrypted: null,
            ttn_api_key_last4: null,
            ttn_api_key_id: null,
            ttn_webhook_secret_encrypted: null,
            ttn_webhook_secret_last4: null,
            ttn_webhook_url: null,
            provisioning_status: "not_started",
            provisioning_error: null,
            provisioning_last_step: null,
            provisioning_step_details: null,
            ttn_application_provisioned_at: null,
            is_enabled: false,
            updated_by: user.id,
          })
          .eq("organization_id", organization_id);

        await logProvisioningStep(supabase, organization_id, "delete_application", "success", "TTN application deleted", undefined, undefined, requestId);

        // Log event
        await supabase.from("event_logs").insert({
          organization_id: organization_id,
          event_type: "ttn.application.deleted",
          category: "settings",
          severity: "warning",
          title: "TTN Application Deleted",
          actor_id: user.id,
          event_data: {
            ttn_application_id: ttnConn.ttn_application_id,
            request_id: requestId,
          },
        });

        return new Response(
          JSON.stringify({ success: true, message: "TTN application deleted", request_id: requestId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (deleteError) {
        const errorMessage = deleteError instanceof Error ? deleteError.message : "Unknown error";
        console.error(`[ttn-provision-org] [${requestId}] Delete failed:`, deleteError);
        await logProvisioningStep(supabase, organization_id, "delete_application", "failed", errorMessage, undefined, undefined, requestId);

        return new Response(
          JSON.stringify({ success: false, error: "Delete failed", details: errorMessage, request_id: requestId }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Unknown action", request_id: requestId }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ttn-provision-org] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error", request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
