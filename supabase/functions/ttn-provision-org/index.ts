/**
 * TTN Organization Provisioning Edge Function
 * 
 * ARCHITECTURE: Hybrid Key Model
 * ==============================
 * - Steps 0-2B use the Main User API Key (TTN_ADMIN_API_KEY)
 * - Steps 3-4 use the Org API Key (created in Step 1B)
 * 
 * The Org API Key has RIGHT_APPLICATION_ALL which is required to
 * create API keys and webhooks for applications within the org.
 * The Main User API Key can create organizations and applications,
 * but may not have collaborator rights to manage them afterward.
 * 
 * PROVISIONING STEPS:
 * - Step 0: Preflight - Validate Main User API Key has required rights
 * - Step 1: Create TTN Organization (idempotent) - uses TTN_ADMIN_API_KEY
 * - Step 1B: Create Org API Key (output artifact) - uses TTN_ADMIN_API_KEY
 * - Step 2: Create TTN Application (idempotent) - uses TTN_ADMIN_API_KEY
 * - Step 2B: Verify Application Rights - check if we own the app
 * - Step 3: Create App API Key - uses ORG_API_KEY (hybrid model)
 * - Step 3B: Create Gateway API Key (optional) - uses ORG_API_KEY
 * - Step 4: Create/Update Webhook - uses ORG_API_KEY
 * 
 * Steps 0-2B use TTN_ADMIN_API_KEY, Steps 3-4 use ORG_API_KEY.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateTtnApplicationId,
  generateTtnOrganizationId,
  generateCollisionSafeOrgId,
  sanitizeTtnSlug,
  generateWebhookSecret,
  obfuscateKey,
  deobfuscateKey,
  getLast4,
} from "../_shared/ttnConfig.ts";
import {
  APPLICATION_KEY_RIGHTS,
  ORGANIZATION_KEY_RIGHTS,
  GATEWAY_KEY_RIGHTS,
  validateMainUserApiKey,
} from "../_shared/ttnPermissions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Token source constant - ALL provisioning uses this single key
const TOKEN_SOURCE = "main_user_api_key";

interface ProvisionOrgRequest {
  action: "provision" | "status" | "delete" | "regenerate_webhook_secret" | "retry" | "start_fresh";
  organization_id: string;
  ttn_region?: string;
}

interface TTNErrorDetails {
  namespace?: string;
  name?: string;
  correlation_id?: string;
  message_format?: string;
  code?: number;
}

const REGIONAL_URLS: Record<string, string> = {
  nam1: "https://nam1.cloud.thethings.network",
  eu1: "https://eu1.cloud.thethings.network",
  au1: "https://au1.cloud.thethings.network",
  as1: "https://as1.cloud.thethings.network",
};

// Identity Server is always on eu1 for all TTN v3 clusters
const IDENTITY_SERVER_URL = "https://eu1.cloud.thethings.network";

// Request timeout in milliseconds
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Parse TTN error response to extract structured details
 */
function parseTTNError(errorText: string): TTNErrorDetails {
  try {
    const parsed = JSON.parse(errorText);
    // TTN error format: { details: [{ "@type": "...", namespace: "...", name: "...", correlation_id: "..." }] }
    const detail = parsed?.details?.[0] || parsed;
    return {
      namespace: detail?.namespace || parsed?.namespace,
      name: detail?.name || parsed?.name,
      correlation_id: detail?.correlation_id || parsed?.correlation_id,
      message_format: detail?.message_format || parsed?.message,
      code: parsed?.code,
    };
  } catch {
    return {};
  }
}

/**
 * Check if error indicates "no rights" to an application
 */
function isNoApplicationRightsError(errorText: string, statusCode: number): boolean {
  if (statusCode !== 403) return false;
  const details = parseTTNError(errorText);
  return details.name === "no_application_rights" || errorText.includes("no_application_rights");
}

/**
 * Check if error indicates "no rights" to an organization
 */
function isNoOrganizationRightsError(errorText: string, statusCode: number): boolean {
  if (statusCode !== 403) return false;
  const details = parseTTNError(errorText);
  return details.name === "no_organization_rights" || errorText.includes("no_organization_rights");
}

/**
 * Classify error for better diagnostics
 */
function classifyError(error: unknown, statusCode?: number): string {
  if (statusCode === 401) return "authentication";
  if (statusCode === 403) return "authorization";
  if (statusCode === 404) return "not_found";
  if (statusCode === 409) return "conflict";
  if (statusCode && statusCode >= 500) return "server_error";
  
  if (error instanceof Error) {
    if (error.message.includes("timeout")) return "timeout";
    if (error.message.includes("network") || error.message.includes("fetch")) return "network";
  }
  
  const errorStr = String(error);
  if (errorStr.includes("permission") || errorStr.includes("denied")) return "authorization";
  if (errorStr.includes("not found")) return "not_found";
  if (errorStr.includes("no_application_rights")) return "no_application_rights";
  if (errorStr.includes("no_organization_rights")) return "no_organization_rights";
  
  return "unknown";
}

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
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Log a provisioning step to the database
 * CRITICAL: Always includes token_source to prove single-credential model
 */
async function logProvisioningStep(
  supabase: SupabaseClient,
  organizationId: string,
  step: string,
  status: "started" | "success" | "failed" | "skipped",
  message: string,
  payload?: Record<string, unknown>,
  durationMs?: number,
  requestId?: string,
  ttnHttpStatus?: number,
  ttnResponseBody?: string,
  errorCategory?: string,
  ttnEndpoint?: string
): Promise<void> {
  try {
    await supabase.from("ttn_provisioning_logs").insert({
      organization_id: organizationId,
      step,
      status,
      message,
      payload: payload ? { ...payload, token_source: TOKEN_SOURCE } : { token_source: TOKEN_SOURCE },
      duration_ms: durationMs || null,
      request_id: requestId || null,
      ttn_http_status: ttnHttpStatus || null,
      ttn_response_body: ttnResponseBody?.slice(0, 2000) || null,
      error_category: errorCategory || null,
      ttn_endpoint: ttnEndpoint || null,
    });
  } catch (err) {
    console.error(`[ttn-provision-org] Failed to log step ${step}:`, err);
  }
}

/**
 * Update provisioning state in the database
 */
async function updateProvisioningState(
  supabase: SupabaseClient,
  organizationId: string,
  patch: {
    status?: "idle" | "provisioning" | "ready" | "failed";
    step?: string;
    error?: string | null;
    last_http_status?: number;
    last_http_body?: string;
    app_rights_check_status?: string;
    last_ttn_correlation_id?: string;
    last_ttn_error_namespace?: string;
    last_ttn_error_name?: string;
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
    updateData.provisioning_last_step = patch.step;
  }
  if (patch.error !== undefined) {
    updateData.provisioning_error = patch.error;
    if (patch.error) {
      updateData.provisioning_can_retry = true;
    }
  }
  if (patch.last_http_status !== undefined) {
    updateData.last_http_status = patch.last_http_status;
    updateData.last_ttn_http_status = patch.last_http_status;
  }
  if (patch.last_http_body !== undefined) {
    updateData.last_http_body = patch.last_http_body?.slice(0, 2000);
  }
  if (patch.app_rights_check_status !== undefined) {
    updateData.app_rights_check_status = patch.app_rights_check_status;
  }
  if (patch.last_ttn_correlation_id !== undefined) {
    updateData.last_ttn_correlation_id = patch.last_ttn_correlation_id;
  }
  if (patch.last_ttn_error_namespace !== undefined) {
    updateData.last_ttn_error_namespace = patch.last_ttn_error_namespace;
  }
  if (patch.last_ttn_error_name !== undefined) {
    updateData.last_ttn_error_name = patch.last_ttn_error_name;
  }

  const { error } = await supabase
    .from("ttn_connections")
    .update(updateData)
    .eq("organization_id", organizationId);
    
  if (error) {
    console.error(`[ttn-provision-org] Failed to update state:`, error);
  }
}

/**
 * Generate a new unique application ID with suffix
 */
function generateNewApplicationId(orgSlug: string): string {
  const suffix = crypto.randomUUID().slice(0, 4).toLowerCase();
  const sanitizedSlug = orgSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20);
  return `fg-${sanitizedSlug}-${suffix}`;
}

/**
 * Build a structured success/failure response (always HTTP 200 for app-level outcomes)
 */
function buildResponse(
  data: {
    success: boolean;
    message?: string;
    error?: string;
    step?: string;
    retryable?: boolean;
    use_start_fresh?: boolean;
    request_id: string;
    token_source?: string;
    [key: string]: unknown;
  }
): Response {
  return new Response(
    JSON.stringify({
      ...data,
      token_source: data.token_source || TOKEN_SOURCE,
    }),
    { 
      status: 200, // Always 200 for application-level responses
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

serve(async (req) => {
  const BUILD_VERSION = "ttn-provision-org-v5.8-strict-key-persist-20260105";
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[ttn-provision-org] [${requestId}] Build: ${BUILD_VERSION}`);
  console.log(`[ttn-provision-org] [${requestId}] Token source for ALL steps: ${TOKEN_SOURCE}`);

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
          ready: hasTtnAdminKey,
        },
        architecture: "single-credential-model-v4",
        token_source: TOKEN_SOURCE,
        steps: [
          "0: Preflight - Validate Main User API Key",
          "1: Create Organization (using Main User API Key)",
          "1B: Create Org API Key [output artifact] (using Main User API Key)",
          "2: Create Application (using Main User API Key)",
          "2B: Verify Application Rights (ownership check)",
          "3: Create App API Key [output artifact] (using Main User API Key)",
          "3B: Create Gateway Key [optional output artifact] (using Main User API Key)",
          "4: Create Webhook (using Main User API Key)",
        ],
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
      return buildResponse({ 
        success: false, 
        error: "Missing Supabase credentials", 
        request_id: requestId,
        retryable: false,
      });
    }

    if (!ttnAdminKey) {
      return buildResponse({
        success: false,
        error: "TTN_ADMIN_API_KEY not configured",
        message: "Add the Main User API Key (Personal API Key with full rights) as a secret in the project settings",
        request_id: requestId,
        retryable: false,
      });
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
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user session", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: ProvisionOrgRequest = await req.json();
    const { action, organization_id, ttn_region } = body;
    const region = (ttn_region || "eu1").toLowerCase();

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
    // ACTION: STATUS
    // ========================================
    if (action === "status") {
      let statusValue = ttnConn?.provisioning_status || "idle";
      if (statusValue === "not_started") statusValue = "idle";
      if (statusValue === "completed") statusValue = "ready";

      return buildResponse({
        success: true,
        request_id: requestId,
        provisioning_status: statusValue,
        provisioning_step: ttnConn?.provisioning_step || null,
        provisioning_error: ttnConn?.provisioning_error || null,
        last_http_status: ttnConn?.last_http_status || null,
        last_http_body: ttnConn?.last_http_body || null,
        app_rights_check_status: ttnConn?.app_rights_check_status || null,
        last_ttn_correlation_id: ttnConn?.last_ttn_correlation_id || null,
        last_ttn_error_name: ttnConn?.last_ttn_error_name || null,
        // TTN Organization info (use canonical tts_* columns)
        ttn_organization_id: ttnConn?.tts_organization_id || null,
        has_org_api_key: !!ttnConn?.ttn_org_api_key_encrypted,
        // TTN Application info
        ttn_application_id: ttnConn?.ttn_application_id || null,
        ttn_region: ttnConn?.ttn_region || "eu1",
        has_app_api_key: !!ttnConn?.ttn_api_key_encrypted,
        has_webhook_secret: !!ttnConn?.ttn_webhook_secret_encrypted,
        webhook_url: ttnConn?.ttn_webhook_url || null,
        provisioned_at: ttnConn?.ttn_application_provisioned_at || null,
      });
    }

    // ========================================
    // ACTION: PROVISION, RETRY, or START_FRESH
    // ========================================
    if (action === "provision" || action === "retry" || action === "start_fresh") {
      // For "retry": check if app is unowned, guide to start_fresh
      if (action === "retry" && ttnConn?.app_rights_check_status === "forbidden") {
        console.log(`[ttn-provision-org] [${requestId}] Retry blocked: app is unowned, must use start_fresh`);
        return buildResponse({
          success: false,
          error: "Application exists but current key has no rights to it",
          message: "This TTN application exists but the current provisioning key has no rights to it. Use 'Start Fresh' to recreate or generate a new app ID.",
          step: "verify_application_rights",
          retryable: false,
          use_start_fresh: true,
          request_id: requestId,
        });
      }

      // Check if already provisioned (only for fresh provision)
      if (
        action === "provision" &&
        ttnConn?.ttn_application_id &&
        (ttnConn.provisioning_status === "completed" || ttnConn.provisioning_status === "ready")
      ) {
      return buildResponse({
        success: true,
        message: "TTN application already provisioned",
        ttn_organization_id: ttnConn.tts_organization_id,
        ttn_application_id: ttnConn.ttn_application_id,
        provisioning_status: "ready",
        request_id: requestId,
      });
      }

      // Generate TTN organization and application IDs
      const ttnOrgId = generateTtnOrganizationId(org.id);
      
      // For start_fresh: may need to rotate app ID
      let ttnAppId = ttnConn?.ttn_application_id || generateTtnApplicationId(org.id);
      let appIdRotated = false;
      
      if (action === "start_fresh" && ttnConn?.app_rights_check_status === "forbidden") {
        // Try to delete the existing app first
        console.log(`[ttn-provision-org] [${requestId}] Start Fresh: attempting to delete unowned app ${ttnAppId}`);
        
        try {
          const deleteResponse = await fetchWithTimeout(
            `${IDENTITY_SERVER_URL}/api/v3/applications/${ttnAppId}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${ttnAdminKey}` },
            }
          );
          
          if (deleteResponse.ok || deleteResponse.status === 404) {
            console.log(`[ttn-provision-org] [${requestId}] Deleted existing app or not found, will recreate`);
            await logProvisioningStep(supabase, organization_id, "delete_unowned_app", "success", 
              "Deleted unowned application to start fresh", { old_app_id: ttnAppId }, undefined, requestId);
          } else {
            // Cannot delete, generate new app ID
            const oldAppId = ttnAppId;
            ttnAppId = generateNewApplicationId(org.slug);
            appIdRotated = true;
            console.log(`[ttn-provision-org] [${requestId}] Cannot delete app, rotating ID: ${oldAppId} -> ${ttnAppId}`);
            await logProvisioningStep(supabase, organization_id, "rotate_app_id", "success", 
              `Rotated application ID: ${oldAppId} -> ${ttnAppId}`, { old_app_id: oldAppId, new_app_id: ttnAppId }, undefined, requestId);
          }
        } catch (err) {
          // Delete failed, generate new app ID
          const oldAppId = ttnAppId;
          ttnAppId = generateNewApplicationId(org.slug);
          appIdRotated = true;
          console.log(`[ttn-provision-org] [${requestId}] Delete failed, rotating ID: ${oldAppId} -> ${ttnAppId}`);
        }
        
        // Clear app-dependent outputs
        await supabase
          .from("ttn_connections")
          .update({
            ttn_application_id: ttnAppId,
            ttn_api_key_encrypted: null,
            ttn_api_key_last4: null,
            ttn_api_key_id: null,
            ttn_webhook_secret_encrypted: null,
            ttn_webhook_secret_last4: null,
            ttn_webhook_url: null,
            ttn_webhook_id: null,
            app_rights_check_status: null,
            provisioning_step_details: null,
          })
          .eq("organization_id", organization_id);
      }
      
      console.log(`[ttn-provision-org] [${requestId}] Provisioning TTN org: ${ttnOrgId}, app: ${ttnAppId} for org ${org.slug}${appIdRotated ? ' (rotated)' : ''}`);
      console.log(`[ttn-provision-org] [${requestId}] ALL STEPS will use token_source: ${TOKEN_SOURCE}`);

      // Track completed steps for idempotency
      let completedSteps: Record<string, unknown> = {};
      if (!appIdRotated && action !== "start_fresh") {
        completedSteps = ttnConn?.provisioning_step_details || {};
      }

      // ============ CONSISTENCY REPAIR: Fix stale org_api_key_created flag ============
      // If the step cache says org key was created but DB has no encrypted key, reset the flag
      if (completedSteps.org_api_key_created && !ttnConn?.ttn_org_api_key_encrypted) {
        console.log(`[ttn-provision-org] [${requestId}] CONSISTENCY REPAIR: org_api_key_created=true but ttn_org_api_key_encrypted is NULL - resetting flag`);
        await logProvisioningStep(supabase, organization_id, "consistency_repair", "success", 
          "Reset org_api_key_created flag - key was not persisted", 
          { had_flag: true, had_key: false }, undefined, requestId);
        completedSteps.org_api_key_created = false;
        await supabase
          .from("ttn_connections")
          .update({ provisioning_step_details: completedSteps })
          .eq("organization_id", organization_id);
      }

      // Ensure absolute webhook URL with defensive validation
      const trimmedSupabaseUrl = (supabaseUrl || "").trim();
      if (!trimmedSupabaseUrl) {
        console.error(`[ttn-provision-org] [${requestId}] SUPABASE_URL is empty or undefined`);
        return buildResponse({
          success: false,
          error: "SUPABASE_URL environment variable is not configured",
          step: "init",
          retryable: false,
          request_id: requestId,
        });
      }
      
      // Normalize URL: ensure https prefix and remove trailing slash
      let normalizedUrl = trimmedSupabaseUrl;
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      normalizedUrl = normalizedUrl.replace(/\/+$/, ""); // Remove trailing slashes
      
      const webhookUrl = `${normalizedUrl}/functions/v1/ttn-webhook`;
      console.log(`[ttn-provision-org] [${requestId}] Webhook URL constructed: ${webhookUrl}`);
      
      const regionalUrl = REGIONAL_URLS[region] || REGIONAL_URLS.eu1;

      // Initialize or update ttn_connections record
      if (ttnConn) {
        await supabase
          .from("ttn_connections")
          .update({
            ttn_region: region,
            ttn_application_id: ttnAppId,
            provisioning_status: "provisioning",
            provisioning_step: "init",
            provisioning_error: null,
            provisioning_last_heartbeat_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq("id", ttnConn.id);
      } else {
        const { data: newConn } = await supabase
          .from("ttn_connections")
          .insert({
            organization_id: organization_id,
            ttn_region: region,
            ttn_application_id: ttnAppId,
            provisioning_status: "provisioning",
            provisioning_step: "init",
            provisioning_started_at: new Date().toISOString(),
            provisioning_last_heartbeat_at: new Date().toISOString(),
            created_by: user.id,
          })
          .select()
          .single();
        ttnConn = newConn;
      }

      try {
        // ============ STEP 0: Preflight - Verify Main User API Key ============
        // CRITICAL FIX: ALWAYS run preflight to get fresh user_id from the current TTN_ADMIN_API_KEY
        // This prevents stale cached preflight_user_id from causing 403 errors when keys change
        const step0Start = Date.now();
        const cachedPreflightUserId = completedSteps.preflight_user_id as string | undefined;
        console.log(`[ttn-provision-org] [${requestId}] Step 0: Cached preflight_user_id="${cachedPreflightUserId || 'none'}", forcing fresh preflight`);
        
        // Always run preflight - never skip based on preflight_done
        {
          const ttnEndpoint = `${IDENTITY_SERVER_URL}/api/v3/auth_info`;
          await logProvisioningStep(supabase, organization_id, "preflight", "started", 
            `Verifying Main User API Key (token_source: ${TOKEN_SOURCE})`, 
            { endpoint: ttnEndpoint }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "preflight" });

          console.log(`[ttn-provision-org] [${requestId}] Step 0: Preflight check (token_source: ${TOKEN_SOURCE})`);

          // Use the shared validation function
          const preflightResult = await validateMainUserApiKey(region, ttnAdminKey, requestId);
          
          if (!preflightResult.success) {
            const duration = Date.now() - step0Start;
            await logProvisioningStep(supabase, organization_id, "preflight", "failed", 
              preflightResult.error || "Preflight validation failed", 
              { hint: preflightResult.hint }, duration, requestId, preflightResult.statusCode, 
              preflightResult.hint, "authentication", ttnEndpoint);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              error: preflightResult.error,
              last_http_status: preflightResult.statusCode,
              last_http_body: preflightResult.hint,
            });
            
            return buildResponse({
              success: false,
              error: preflightResult.error || "Preflight validation failed",
              message: preflightResult.hint,
              step: "preflight",
              retryable: true,
              request_id: requestId,
            });
          }

          const duration = Date.now() - step0Start;
          await logProvisioningStep(supabase, organization_id, "preflight", "success", 
            `Main User API Key verified (user: ${preflightResult.user_id}, is_admin: ${preflightResult.is_admin})`, 
            { user_id: preflightResult.user_id, is_admin: preflightResult.is_admin }, 
            duration, requestId, undefined, undefined, undefined, ttnEndpoint);
          completedSteps.preflight_done = true;
          completedSteps.preflight_user_id = preflightResult.user_id;
          
          // Log if user_id changed from cached value
          if (cachedPreflightUserId && cachedPreflightUserId !== preflightResult.user_id) {
            console.log(`[ttn-provision-org] [${requestId}] Step 0: User ID CHANGED: "${cachedPreflightUserId}" -> "${preflightResult.user_id}"`);
            await logProvisioningStep(supabase, organization_id, "preflight_user_changed", "success", 
              `User ID updated from cached value`, 
              { old_user_id: cachedPreflightUserId, new_user_id: preflightResult.user_id }, 
              undefined, requestId);
          }

          await supabase
            .from("ttn_connections")
            .update({ provisioning_step_details: completedSteps })
            .eq("organization_id", organization_id);
        }

        // ============ STEP 1: Create TTN Organization (using Main User API Key) ============
        // FIX: TTN requires user-scoped endpoint: POST /api/v3/users/{user_id}/organizations
        // The global /api/v3/organizations endpoint returns "Method Not Allowed" for POST
        // Handle 201 = created, 409 = exists (verify), anything else = fail
        // NEW: Auto-rotate org ID on collision (409+403/404) to handle orphaned org IDs
        const step1Start = Date.now();
        
        // Use stored org ID if we rotated previously, otherwise use generated ID
        let effectiveTtnOrgId = (completedSteps.effective_ttn_org_id as string) || ttnOrgId;
        const maxOrgRotationAttempts = 3;
        let orgRotationAttempts = (completedSteps.org_rotation_attempts as number) || 0;
        
        // Organization creation loop - handles collision detection and auto-rotation
        orgCreationLoop: while (!completedSteps.organization_created || !completedSteps.organization_verified) {
          // Use user-scoped endpoint - TTN requires this for organization creation
          // CRITICAL: Use the FRESH preflight_user_id from Step 0, never a hardcoded fallback
          const preflightUserId = completedSteps.preflight_user_id as string;
          if (!preflightUserId || preflightUserId === "unknown") {
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              error: "Preflight did not return a valid user_id",
            });
            return buildResponse({
              success: false,
              error: "Preflight did not return a valid TTN user_id. Check that TTN_ADMIN_API_KEY is a Personal API Key.",
              step: "create_organization",
              retryable: true,
              request_id: requestId,
            });
          }
          console.log(`[ttn-provision-org] [${requestId}] Step 1: Using preflight_user_id="${preflightUserId}" for org creation endpoint`);
          console.log(`[ttn-provision-org] [${requestId}] Step 1: Org ID attempt: "${effectiveTtnOrgId}" (rotation ${orgRotationAttempts}/${maxOrgRotationAttempts})`);
          
          const ttnEndpoint = `${IDENTITY_SERVER_URL}/api/v3/users/${preflightUserId}/organizations`;
          const createPayload = {
            organization: {
              ids: { organization_id: effectiveTtnOrgId },
              name: `FrostGuard - ${org.name}`,
              description: `FrostGuard temperature monitoring organization for ${org.name}`,
            },
          };
          
          await logProvisioningStep(supabase, organization_id, "create_organization", "started", 
            `Creating TTN organization (token_source: ${TOKEN_SOURCE})`, 
            { 
              ttn_org_id: effectiveTtnOrgId, 
              endpoint: ttnEndpoint,
              base_url: IDENTITY_SERVER_URL,
              payload: { org_id: effectiveTtnOrgId, name: createPayload.organization.name },
              rotation_attempt: orgRotationAttempts,
            }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "create_ttn_org" });

          console.log(`[ttn-provision-org] [${requestId}] Step 1: Creating TTN organization ${effectiveTtnOrgId}`);
          console.log(`[ttn-provision-org] [${requestId}] Step 1: Endpoint: ${ttnEndpoint}`);
          console.log(`[ttn-provision-org] [${requestId}] Step 1: Payload: ${JSON.stringify(createPayload)}`);

          let createOrgResponse: Response;
          let createResponseText = "";
          try {
            createOrgResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ttnAdminKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(createPayload),
              }
            );
            createResponseText = await createOrgResponse.text();
            console.log(`[ttn-provision-org] [${requestId}] Step 1: Response status=${createOrgResponse.status}, body=${createResponseText.slice(0, 500)}`);
          } catch (fetchErr) {
            const duration = Date.now() - step1Start;
            const category = classifyError(fetchErr);
            const errMsg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed";
            await logProvisioningStep(supabase, organization_id, "create_organization", "failed", errMsg, { error: errMsg }, duration, requestId, undefined, undefined, category, ttnEndpoint);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_organization",
              error: errMsg,
            });
            
            return buildResponse({
              success: false,
              error: errMsg,
              step: "create_organization",
              retryable: category === "timeout" || category === "network",
              request_id: requestId,
            });
          }

          // Handle response: 200/201 = created/success, 409 = exists, anything else = fail BEFORE verification
          if (createOrgResponse.status !== 200 && createOrgResponse.status !== 201 && createOrgResponse.status !== 409) {
            const duration = Date.now() - step1Start;
            const category = classifyError(createResponseText, createOrgResponse.status);
            const ttnError = parseTTNError(createResponseText);
            
            await logProvisioningStep(supabase, organization_id, "create_organization", "failed", 
              `HTTP ${createOrgResponse.status}`, 
              { status: createOrgResponse.status, response: createResponseText.slice(0, 500) }, 
              duration, requestId, createOrgResponse.status, createResponseText, category, ttnEndpoint);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_organization",
              error: `Failed to create TTN organization: ${createOrgResponse.status}`,
              last_http_status: createOrgResponse.status,
              last_http_body: createResponseText,
              last_ttn_correlation_id: ttnError.correlation_id,
              last_ttn_error_namespace: ttnError.namespace,
              last_ttn_error_name: ttnError.name,
            });
            
            return buildResponse({
              success: false,
              error: `Failed to create TTN organization: ${createOrgResponse.status}`,
              step: "create_organization",
              retryable: createOrgResponse.status >= 500,
              request_id: requestId,
              correlation_id: ttnError.correlation_id,
            });
          }

          // Mark as potentially created (200/201) or existing (409) - either way, proceed to verification
          const wasCreated = createOrgResponse.status === 200 || createOrgResponse.status === 201;
          console.log(`[ttn-provision-org] [${requestId}] Step 1: Org ${wasCreated ? 'created (200/201)' : 'exists (409)'}, proceeding to verification`);

          // ============ STEP 1 VERIFICATION: Verify org exists and we have rights ============
          console.log(`[ttn-provision-org] [${requestId}] Step 1 Verification: Checking org ${effectiveTtnOrgId}`);
          
          // 1a. Check org exists
          const verifyOrgEndpoint = `${IDENTITY_SERVER_URL}/api/v3/organizations/${effectiveTtnOrgId}`;
          let verifyOrgResponse: Response;
          try {
            verifyOrgResponse = await fetchWithTimeout(verifyOrgEndpoint, {
              method: "GET",
              headers: { Authorization: `Bearer ${ttnAdminKey}` },
            });
          } catch (fetchErr) {
            const duration = Date.now() - step1Start;
            const errMsg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed";
            await logProvisioningStep(supabase, organization_id, "verify_organization", "failed", 
              `Failed to verify org: ${errMsg}`, {}, duration, requestId);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_organization",
              error: `Failed to verify organization: ${errMsg}`,
            });
            
            return buildResponse({
              success: false,
              error: `Failed to verify organization: ${errMsg}`,
              step: "create_organization",
              retryable: true,
              request_id: requestId,
            });
          }

          if (!verifyOrgResponse.ok) {
            const verifyText = await verifyOrgResponse.text();
            const duration = Date.now() - step1Start;
            
            // If org doesn't exist (404) or we have no rights (403), this is a COLLISION
            // The org exists under a different account. Try rotating the org ID.
            if (verifyOrgResponse.status === 404 || verifyOrgResponse.status === 403) {
              const isNoRights = isNoOrganizationRightsError(verifyText, verifyOrgResponse.status);
              const ttnError = parseTTNError(verifyText);
              
              // Check if we can rotate
              if (orgRotationAttempts < maxOrgRotationAttempts) {
                // Rotate the org ID and retry
                const oldOrgId = effectiveTtnOrgId;
                effectiveTtnOrgId = generateCollisionSafeOrgId(organization_id);
                orgRotationAttempts++;
                
                console.log(`[ttn-provision-org] [${requestId}] ORG COLLISION DETECTED: "${oldOrgId}" exists but no access (${verifyOrgResponse.status})`);
                console.log(`[ttn-provision-org] [${requestId}] Rotating org ID: "${oldOrgId}" -> "${effectiveTtnOrgId}" (attempt ${orgRotationAttempts}/${maxOrgRotationAttempts})`);
                
                await logProvisioningStep(supabase, organization_id, "rotate_org_id", "success", 
                  `Rotated org ID due to collision (${verifyOrgResponse.status})`, 
                  { 
                    old_org_id: oldOrgId, 
                    new_org_id: effectiveTtnOrgId, 
                    rotation_attempt: orgRotationAttempts,
                    verify_status: verifyOrgResponse.status,
                  }, 
                  duration, requestId);
                
                // Persist the new org ID and rotation state
                completedSteps.effective_ttn_org_id = effectiveTtnOrgId;
                completedSteps.org_rotation_attempts = orgRotationAttempts;
                completedSteps.organization_created = false;
                completedSteps.organization_verified = false;
                
                await supabase
                  .from("ttn_connections")
                  .update({ 
                    tts_organization_id: effectiveTtnOrgId,
                    provisioning_step_details: completedSteps,
                    provisioning_error: null, // Clear previous error
                  })
                  .eq("organization_id", organization_id);
                
                // Continue the loop to retry with new org ID
                continue orgCreationLoop;
              }
              
              // Max rotation attempts reached - fail permanently
              await logProvisioningStep(supabase, organization_id, "verify_organization", "failed", 
                `Org verification failed after ${orgRotationAttempts} rotation attempts: ${verifyOrgResponse.status}`, 
                { status: verifyOrgResponse.status, response: verifyText.slice(0, 500), rotation_attempts: orgRotationAttempts }, 
                duration, requestId, verifyOrgResponse.status, verifyText, undefined, verifyOrgEndpoint);
              
              await updateProvisioningState(supabase, organization_id, {
                status: "failed",
                step: "create_organization",
                error: `Max org ID rotation attempts (${maxOrgRotationAttempts}) reached. Contact support.`,
                last_http_status: verifyOrgResponse.status,
                last_http_body: verifyText,
                last_ttn_error_name: isNoRights ? "no_organization_rights" : ttnError.name,
              });
              
              return buildResponse({
                success: false,
                error: `Max org ID rotation attempts (${maxOrgRotationAttempts}) reached. The TTN namespace may be saturated. Contact support.`,
                step: "create_organization",
                retryable: false,
                use_start_fresh: true,
                request_id: requestId,
              });
            }
          }
          
          // 1b. Check we have RIGHT_ORGANIZATION_SETTINGS_API_KEYS
          const verifyRightsEndpoint = `${IDENTITY_SERVER_URL}/api/v3/organizations/${effectiveTtnOrgId}/rights`;
          let verifyRightsResponse: Response;
          try {
            verifyRightsResponse = await fetchWithTimeout(verifyRightsEndpoint, {
              method: "GET",
              headers: { Authorization: `Bearer ${ttnAdminKey}` },
            });
          } catch (fetchErr) {
            const duration = Date.now() - step1Start;
            const errMsg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed";
            await logProvisioningStep(supabase, organization_id, "verify_organization", "failed", 
              `Failed to verify org rights: ${errMsg}`, {}, duration, requestId);
            
            return buildResponse({
              success: false,
              error: `Failed to verify organization rights: ${errMsg}`,
              step: "create_organization",
              retryable: true,
              request_id: requestId,
            });
          }

          if (!verifyRightsResponse.ok) {
            const rightsText = await verifyRightsResponse.text();
            const duration = Date.now() - step1Start;
            const isNoRights = isNoOrganizationRightsError(rightsText, verifyRightsResponse.status);
            
            await logProvisioningStep(supabase, organization_id, "verify_organization", "failed", 
              `Org rights check failed: ${verifyRightsResponse.status}`, 
              { status: verifyRightsResponse.status }, duration, requestId, verifyRightsResponse.status, rightsText);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_organization",
              error: isNoRights 
                ? "No organization rights" 
                : `Organization rights check failed: ${verifyRightsResponse.status}`,
              last_http_status: verifyRightsResponse.status,
              last_http_body: rightsText,
              last_ttn_error_name: isNoRights ? "no_organization_rights" : undefined,
            });
            
            return buildResponse({
              success: false,
              error: isNoRights 
                ? "No organization rights - org may exist under another account"
                : `Organization rights check failed: ${verifyRightsResponse.status}`,
              step: "create_organization",
              retryable: false,
              use_start_fresh: true,
              request_id: requestId,
            });
          }

          // Parse rights and check for required right
          const rightsData = await verifyRightsResponse.json();
          const orgRights: string[] = rightsData.rights || [];
          const hasOrgApiKeyRight = orgRights.some(r => 
            r === "RIGHT_ORGANIZATION_SETTINGS_API_KEYS" || r === "RIGHT_ORGANIZATION_ALL"
          );

          if (!hasOrgApiKeyRight) {
            const duration = Date.now() - step1Start;
            await logProvisioningStep(supabase, organization_id, "verify_organization", "failed", 
              `Missing RIGHT_ORGANIZATION_SETTINGS_API_KEYS`, 
              { available_rights: orgRights }, duration, requestId);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_organization",
              error: "Missing required organization rights (RIGHT_ORGANIZATION_SETTINGS_API_KEYS)",
              last_ttn_error_name: "no_organization_rights",
            });
            
            return buildResponse({
              success: false,
              error: "Missing required organization rights (RIGHT_ORGANIZATION_SETTINGS_API_KEYS)",
              step: "create_organization",
              retryable: false,
              use_start_fresh: true,
              request_id: requestId,
            });
          }

          // VERIFICATION PASSED - mark Step 1 as complete and break the loop
          const duration = Date.now() - step1Start;
          await logProvisioningStep(supabase, organization_id, "create_organization", "success", 
            `TTN organization verified with rights${orgRotationAttempts > 0 ? ` (after ${orgRotationAttempts} rotation(s))` : ''}`, 
            { ttn_org_id: effectiveTtnOrgId, rights: orgRights.length, rotation_attempts: orgRotationAttempts }, 
            duration, requestId, 200, undefined, undefined, verifyRightsEndpoint);
          
          completedSteps.organization_created = true;
          completedSteps.organization_verified = true;
          completedSteps.effective_ttn_org_id = effectiveTtnOrgId;

          await supabase
            .from("ttn_connections")
            .update({
              tts_organization_id: effectiveTtnOrgId,
              tts_org_provisioned_at: new Date().toISOString(),
              provisioning_step_details: completedSteps,
            })
            .eq("organization_id", organization_id);
            
          console.log(`[ttn-provision-org] [${requestId}] Step 1: Organization ${effectiveTtnOrgId} verified successfully${orgRotationAttempts > 0 ? ` (after ${orgRotationAttempts} ID rotation(s))` : ''}`);
          
          // Break out of the loop - org creation complete
          break orgCreationLoop;
        }
        
        // If loop was skipped (org already verified), use stored org ID
        if (completedSteps.organization_created && completedSteps.organization_verified) {
          console.log(`[ttn-provision-org] [${requestId}] Step 1: Skipping (org already created and verified)`);
          if (completedSteps.effective_ttn_org_id) {
            effectiveTtnOrgId = completedSteps.effective_ttn_org_id as string;
          } else if (ttnConn?.tts_organization_id) {
            effectiveTtnOrgId = ttnConn.tts_organization_id;
          }
        }

        // ============ STEP 1B: Create Org-scoped API Key (using Main User API Key) ============
        // GUARD: Only run if organization is verified
        const step1bStart = Date.now();
        if (!completedSteps.org_api_key_created) {
          // Guard: require org verification before creating API key
          if (!completedSteps.organization_verified) {
            console.log(`[ttn-provision-org] [${requestId}] Step 1B: Blocked - org not verified`);
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_org_api_key",
              error: "Organization verification required before creating API key",
            });
            return buildResponse({
              success: false,
              error: "Organization verification required before creating API key",
              step: "create_org_api_key",
              retryable: true,
              request_id: requestId,
            });
          }

          const ttnEndpoint = `${IDENTITY_SERVER_URL}/api/v3/organizations/${effectiveTtnOrgId}/api-keys`;
          await logProvisioningStep(supabase, organization_id, "create_org_api_key", "started", 
            `Creating organization API key [output artifact] (token_source: ${TOKEN_SOURCE})`, 
            { endpoint: ttnEndpoint, org_id: effectiveTtnOrgId }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "create_org_api_key" });

          console.log(`[ttn-provision-org] [${requestId}] Step 1B: Creating org-scoped API key for ${effectiveTtnOrgId} (token_source: ${TOKEN_SOURCE})`);

          let createOrgKeyResponse: Response;
          try {
            createOrgKeyResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ttnAdminKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: `FrostGuard Org Key - ${org.slug}`,
                  rights: ORGANIZATION_KEY_RIGHTS,
                }),
              }
            );
          } catch (fetchErr) {
            const duration = Date.now() - step1bStart;
            const category = classifyError(fetchErr);
            const errMsg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed";
            await logProvisioningStep(supabase, organization_id, "create_org_api_key", "failed", errMsg, { error: errMsg }, duration, requestId, undefined, undefined, category, ttnEndpoint);

            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_org_api_key",
              error: errMsg,
            });
            
            return buildResponse({
              success: false,
              error: errMsg,
              step: "create_org_api_key",
              retryable: category === "timeout" || category === "network",
              request_id: requestId,
            });
          }

          if (!createOrgKeyResponse.ok) {
            const errorText = await createOrgKeyResponse.text();
            const duration = Date.now() - step1bStart;
            const category = classifyError(errorText, createOrgKeyResponse.status);
            const ttnError = parseTTNError(errorText);
            const isNoRights = isNoOrganizationRightsError(errorText, createOrgKeyResponse.status);
            
            await logProvisioningStep(supabase, organization_id, "create_org_api_key", "failed", 
              `HTTP ${createOrgKeyResponse.status}${isNoRights ? ' (no_organization_rights)' : ''}`, 
              { status: createOrgKeyResponse.status }, duration, requestId, createOrgKeyResponse.status, errorText, category, ttnEndpoint);

            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_org_api_key",
              error: isNoRights 
                ? "No organization rights - cannot create API key"
                : `Failed to create organization API key: ${createOrgKeyResponse.status}`,
              last_http_status: createOrgKeyResponse.status,
              last_http_body: errorText,
              last_ttn_correlation_id: ttnError.correlation_id,
              last_ttn_error_name: isNoRights ? "no_organization_rights" : ttnError.name,
            });

            return buildResponse({
              success: false,
              error: isNoRights 
                ? "No organization rights - cannot create API key. Use Start Fresh to recreate."
                : `Failed to create org API key: ${createOrgKeyResponse.status}`,
              step: "create_org_api_key",
              retryable: !isNoRights && createOrgKeyResponse.status >= 500,
              use_start_fresh: isNoRights,
              request_id: requestId,
              correlation_id: ttnError.correlation_id,
            });
          }

          const orgKeyData = await createOrgKeyResponse.json();
          const orgApiKey = orgKeyData.key;
          const orgApiKeyId = orgKeyData.id;

          if (!orgApiKey) {
            const duration = Date.now() - step1bStart;
            await logProvisioningStep(supabase, organization_id, "create_org_api_key", "failed", 
              "TTN returned success but no key value in response", 
              { response_keys: Object.keys(orgKeyData) }, duration, requestId);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_org_api_key",
              error: "TTN did not return API key value",
            });
            
            return buildResponse({
              success: false,
              error: "TTN created org API key but did not return the key value",
              step: "create_org_api_key",
              retryable: true,
              request_id: requestId,
            });
          }

          const encryptedOrgKey = obfuscateKey(orgApiKey, encryptionSalt);
          
          // STRICT PERSISTENCE: Verify the DB write succeeds before marking step complete
          const { error: persistError } = await supabase
            .from("ttn_connections")
            .update({
              ttn_org_api_key_encrypted: encryptedOrgKey,
              ttn_org_api_key_last4: getLast4(orgApiKey),
              ttn_org_api_key_id: orgApiKeyId,
              ttn_org_api_key_updated_at: new Date().toISOString(),
            })
            .eq("organization_id", organization_id);

          if (persistError) {
            const duration = Date.now() - step1bStart;
            console.error(`[ttn-provision-org] [${requestId}] Step 1B: FAILED to persist org API key:`, persistError);
            await logProvisioningStep(supabase, organization_id, "create_org_api_key", "failed", 
              `Created key but failed to persist: ${persistError.message}`, 
              { db_error: persistError.message }, duration, requestId);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_org_api_key",
              error: `Failed to save org API key to database: ${persistError.message}`,
            });
            
            return buildResponse({
              success: false,
              error: "Created org API key but failed to save to database - please retry",
              step: "create_org_api_key",
              retryable: true,
              request_id: requestId,
            });
          }

          // Only mark as complete AFTER successful DB write
          const duration = Date.now() - step1bStart;
          completedSteps.org_api_key_created = true;
          
          await supabase
            .from("ttn_connections")
            .update({ provisioning_step_details: completedSteps })
            .eq("organization_id", organization_id);

          await logProvisioningStep(supabase, organization_id, "create_org_api_key", "success", 
            "Organization API key created and persisted [output artifact]", 
            { key_last4: getLast4(orgApiKey), key_id: orgApiKeyId }, duration, requestId, createOrgKeyResponse.status, undefined, undefined, ttnEndpoint);
          
          console.log(`[ttn-provision-org] [${requestId}] Step 1B: Org API key created and persisted (key_last4: ${getLast4(orgApiKey)})`);
        } else {
          // Verify the key actually exists in DB before skipping
          const { data: keyCheck } = await supabase
            .from("ttn_connections")
            .select("ttn_org_api_key_encrypted, ttn_org_api_key_last4")
            .eq("organization_id", organization_id)
            .single();
          
          if (!keyCheck?.ttn_org_api_key_encrypted) {
            console.log(`[ttn-provision-org] [${requestId}] Step 1B: Flag says created but key missing - re-running step`);
            completedSteps.org_api_key_created = false;
            // Recursive call will re-run this step on next provision attempt
            return buildResponse({
              success: false,
              error: "Org API key flag was set but key not found in database - please retry",
              step: "create_org_api_key",
              retryable: true,
              request_id: requestId,
            });
          }
          
          console.log(`[ttn-provision-org] [${requestId}] Step 1B: Skipping (org key already created, key_last4: ${keyCheck.ttn_org_api_key_last4})`);
        }

        // ============ STEP 2: Create Application under Organization (using Main User API Key) ============
        const step2Start = Date.now();
        if (!completedSteps.application_created) {
          const ttnEndpoint = `${IDENTITY_SERVER_URL}/api/v3/organizations/${effectiveTtnOrgId}/applications`;
          await logProvisioningStep(supabase, organization_id, "create_application", "started", 
            `Creating TTN application under organization (token_source: ${TOKEN_SOURCE})`, 
            { ttn_app_id: ttnAppId, ttn_org_id: effectiveTtnOrgId, endpoint: ttnEndpoint }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "create_application" });

          console.log(`[ttn-provision-org] [${requestId}] Step 2: Creating application ${ttnAppId} under org ${effectiveTtnOrgId} (token_source: ${TOKEN_SOURCE})`);

          let createAppResponse: Response;
          try {
            createAppResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ttnAdminKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  application: {
                    ids: { application_id: ttnAppId },
                    name: `FrostGuard - ${org.name}`,
                    description: `FrostGuard temperature monitoring for ${org.name}`,
                  },
                }),
              }
            );
          } catch (fetchErr) {
            const duration = Date.now() - step2Start;
            const category = classifyError(fetchErr);
            const errMsg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed";
            await logProvisioningStep(supabase, organization_id, "create_application", "failed", errMsg, { error: errMsg }, duration, requestId, undefined, undefined, category, ttnEndpoint);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_application",
              error: errMsg,
            });
            
            return buildResponse({
              success: false,
              error: errMsg,
              step: "create_application",
              retryable: category === "timeout" || category === "network",
              request_id: requestId,
            });
          }

          if (!createAppResponse.ok && createAppResponse.status !== 409) {
            const errorText = await createAppResponse.text();
            const duration = Date.now() - step2Start;
            const category = classifyError(errorText, createAppResponse.status);
            const ttnError = parseTTNError(errorText);
            
            await logProvisioningStep(supabase, organization_id, "create_application", "failed", `HTTP ${createAppResponse.status}`, { status: createAppResponse.status }, duration, requestId, createAppResponse.status, errorText, category, ttnEndpoint);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_application",
              error: `Failed to create application: ${createAppResponse.status}`,
              last_http_status: createAppResponse.status,
              last_http_body: errorText,
              last_ttn_correlation_id: ttnError.correlation_id,
            });
            
            return buildResponse({
              success: false,
              error: `Failed to create application: ${createAppResponse.status}`,
              step: "create_application",
              retryable: createAppResponse.status >= 500,
              request_id: requestId,
              correlation_id: ttnError.correlation_id,
            });
          }

          const duration = Date.now() - step2Start;
          await logProvisioningStep(supabase, organization_id, "create_application", "success", "TTN application created under organization", { ttn_app_id: ttnAppId, ttn_org_id: ttnOrgId }, duration, requestId, createAppResponse.status, undefined, undefined, ttnEndpoint);
          completedSteps.application_created = true;

          await supabase
            .from("ttn_connections")
            .update({
              ttn_application_id: ttnAppId,
              ttn_application_name: `FrostGuard - ${org.name}`,
              provisioning_step_details: completedSteps,
            })
            .eq("organization_id", organization_id);
        } else {
          console.log(`[ttn-provision-org] [${requestId}] Step 2: Skipping (app already created)`);
        }

        // ============ STEP 2B: Verify Application Rights (ownership check) ============
        const step2bStart = Date.now();
        if (!completedSteps.app_rights_verified) {
          const ttnEndpoint = `${IDENTITY_SERVER_URL}/api/v3/applications/${ttnAppId}/rights`;
          await logProvisioningStep(supabase, organization_id, "verify_application_rights", "started", 
            `Verifying application rights (token_source: ${TOKEN_SOURCE})`, 
            { ttn_app_id: ttnAppId, endpoint: ttnEndpoint }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "verify_application_rights" });

          console.log(`[ttn-provision-org] [${requestId}] Step 2B: Verifying rights for application ${ttnAppId}`);

          let rightsResponse: Response;
          try {
            rightsResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "GET",
                headers: { Authorization: `Bearer ${ttnAdminKey}` },
              }
            );
          } catch (fetchErr) {
            const duration = Date.now() - step2bStart;
            const errMsg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed";
            await logProvisioningStep(supabase, organization_id, "verify_application_rights", "failed", errMsg, {}, duration, requestId);
            
            // Network error during rights check - retryable
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "verify_application_rights",
              error: errMsg,
            });
            
            return buildResponse({
              success: false,
              error: errMsg,
              step: "verify_application_rights",
              retryable: true,
              request_id: requestId,
            });
          }

          const rightsText = await rightsResponse.text();
          const ttnError = parseTTNError(rightsText);

          if (rightsResponse.status === 403) {
            // No rights to application - this is the "unowned" state
            const duration = Date.now() - step2bStart;
            await logProvisioningStep(supabase, organization_id, "verify_application_rights", "failed", 
              "No application rights - application unowned by current key", 
              { status: 403, error_name: ttnError.name }, duration, requestId, 403, rightsText, "no_application_rights", ttnEndpoint);

            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "verify_application_rights",
              error: "Application exists but current key has no rights",
              last_http_status: 403,
              last_http_body: rightsText,
              app_rights_check_status: "forbidden",
              last_ttn_correlation_id: ttnError.correlation_id,
              last_ttn_error_namespace: ttnError.namespace,
              last_ttn_error_name: ttnError.name,
            });

            return buildResponse({
              success: false,
              error: "Application exists but current key has no rights",
              message: "This TTN application exists but the current provisioning key has no rights to it. This commonly happens with legacy apps created under another account. Use 'Start Fresh' to recreate or generate a new app ID under the current key.",
              step: "verify_application_rights",
              retryable: false,
              use_start_fresh: true,
              request_id: requestId,
              correlation_id: ttnError.correlation_id,
            });
          }

          if (rightsResponse.status === 404) {
            // Application not found - drift, need to recreate
            const duration = Date.now() - step2bStart;
            await logProvisioningStep(supabase, organization_id, "verify_application_rights", "failed", 
              "Application not found - may have been deleted", 
              { status: 404 }, duration, requestId, 404, rightsText, "not_found", ttnEndpoint);

            await updateProvisioningState(supabase, organization_id, {
              app_rights_check_status: "not_found",
              last_http_status: 404,
            });
            
            // Clear the application_created flag to force recreation
            completedSteps.application_created = false;
            await supabase
              .from("ttn_connections")
              .update({ provisioning_step_details: completedSteps })
              .eq("organization_id", organization_id);
            
            return buildResponse({
              success: false,
              error: "Application not found - may have been deleted externally",
              message: "The TTN application was not found. It may have been deleted from the TTN console. Use 'Start Fresh' to recreate it.",
              step: "verify_application_rights",
              retryable: false,
              use_start_fresh: true,
              request_id: requestId,
            });
          }

          if (!rightsResponse.ok) {
            const duration = Date.now() - step2bStart;
            await logProvisioningStep(supabase, organization_id, "verify_application_rights", "failed", 
              `HTTP ${rightsResponse.status}`, { status: rightsResponse.status }, duration, requestId, rightsResponse.status, rightsText, "unknown", ttnEndpoint);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "verify_application_rights",
              error: `Rights check failed: ${rightsResponse.status}`,
              last_http_status: rightsResponse.status,
              last_http_body: rightsText,
            });
            
            return buildResponse({
              success: false,
              error: `Rights check failed: ${rightsResponse.status}`,
              step: "verify_application_rights",
              retryable: rightsResponse.status >= 500,
              request_id: requestId,
            });
          }

          // Success - we have rights
          const duration = Date.now() - step2bStart;
          await logProvisioningStep(supabase, organization_id, "verify_application_rights", "success", 
            "Application rights verified", { ttn_app_id: ttnAppId }, duration, requestId, 200, undefined, undefined, ttnEndpoint);
          completedSteps.app_rights_verified = true;

          await supabase
            .from("ttn_connections")
            .update({
              app_rights_check_status: "ok",
              provisioning_step_details: completedSteps,
            })
            .eq("organization_id", organization_id);

          console.log(`[ttn-provision-org] [${requestId}] Step 2B: Rights verified for ${ttnAppId}`);
        } else {
          console.log(`[ttn-provision-org] [${requestId}] Step 2B: Skipping (rights already verified)`);
        }

        // ============ RETRIEVE ORG API KEY FOR STEPS 3-4 (Hybrid Model) ============
        // The Org API Key (created in Step 1B) has the rights needed to manage applications
        let orgApiKeyForAppOps: string | null = null;
        if (completedSteps.org_api_key_created) {
          const { data: ttnConnRefresh } = await supabase
            .from("ttn_connections")
            .select("ttn_org_api_key_encrypted")
            .eq("organization_id", organization_id)
            .single();

          if (ttnConnRefresh?.ttn_org_api_key_encrypted) {
            orgApiKeyForAppOps = deobfuscateKey(ttnConnRefresh.ttn_org_api_key_encrypted, encryptionSalt);
            console.log(`[ttn-provision-org] [${requestId}] Retrieved Org API Key for Steps 3-4 (key_last4: ${getLast4(orgApiKeyForAppOps)})`);
          }
        }

        if (!orgApiKeyForAppOps) {
          console.error(`[ttn-provision-org] [${requestId}] Org API Key not found - required for app operations`);
          return buildResponse({
            success: false,
            error: "Org API Key not found - required for app operations. Try 'Start Fresh' to re-provision.",
            step: "retrieve_org_key",
            retryable: true,
            request_id: requestId,
          });
        }

        // ============ STEP 3: Create App-scoped API Key (using Org API Key) ============
        const step3Start = Date.now();
        if (!completedSteps.app_api_key_created) {
          const ttnEndpoint = `${IDENTITY_SERVER_URL}/api/v3/applications/${ttnAppId}/api-keys`;
          await logProvisioningStep(supabase, organization_id, "create_app_api_key", "started", 
            `Creating application API key (token_source: org_api_key)`, 
            { endpoint: ttnEndpoint }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "create_app_api_key" });

          console.log(`[ttn-provision-org] [${requestId}] Step 3: Creating app-scoped API key for ${ttnAppId} (token_source: org_api_key)`);

          let createAppKeyResponse: Response;
          try {
            createAppKeyResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${orgApiKeyForAppOps}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: "FrostGuard Integration",
                  rights: APPLICATION_KEY_RIGHTS,
                }),
              }
            );
          } catch (fetchErr) {
            const duration = Date.now() - step3Start;
            const category = classifyError(fetchErr);
            const errMsg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed";
            await logProvisioningStep(supabase, organization_id, "create_app_api_key", "failed", errMsg, { error: errMsg }, duration, requestId, undefined, undefined, category, ttnEndpoint);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_app_api_key",
              error: errMsg,
            });
            
            return buildResponse({
              success: false,
              error: errMsg,
              step: "create_app_api_key",
              retryable: category === "timeout" || category === "network",
              request_id: requestId,
            });
          }

          if (!createAppKeyResponse.ok) {
            const errorText = await createAppKeyResponse.text();
            const duration = Date.now() - step3Start;
            const category = classifyError(errorText, createAppKeyResponse.status);
            const ttnError = parseTTNError(errorText);

            await logProvisioningStep(supabase, organization_id, "create_app_api_key", "failed", `HTTP ${createAppKeyResponse.status}`, {
              status: createAppKeyResponse.status,
            }, duration, requestId, createAppKeyResponse.status, errorText, category, ttnEndpoint);

            // Check specifically for no_application_rights
            const isNoRights = isNoApplicationRightsError(errorText, createAppKeyResponse.status);

            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_app_api_key",
              error: `Failed to create application API key: ${createAppKeyResponse.status}`,
              last_http_status: createAppKeyResponse.status,
              last_http_body: errorText,
              app_rights_check_status: isNoRights ? "forbidden" : undefined,
              last_ttn_correlation_id: ttnError.correlation_id,
              last_ttn_error_namespace: ttnError.namespace,
              last_ttn_error_name: ttnError.name,
            });

            return buildResponse({
              success: false,
              error: `Failed to create app API key: ${createAppKeyResponse.status} ${ttnError.name || ''}`,
              message: isNoRights 
                ? "This TTN application exists but the current provisioning key has no rights to it. Use 'Start Fresh' to recreate or generate a new app ID."
                : undefined,
              step: "create_app_api_key",
              retryable: !isNoRights && createAppKeyResponse.status >= 500,
              use_start_fresh: isNoRights,
              request_id: requestId,
              correlation_id: ttnError.correlation_id,
            });
          }

          const appKeyData = await createAppKeyResponse.json();
          const appApiKey = appKeyData.key;
          const appApiKeyId = appKeyData.id;

          const duration = Date.now() - step3Start;
          await logProvisioningStep(supabase, organization_id, "create_app_api_key", "success", "Application API key created [output artifact]", { key_last4: getLast4(appApiKey) }, duration, requestId, createAppKeyResponse.status, undefined, undefined, ttnEndpoint);
          completedSteps.app_api_key_created = true;

          const encryptedAppKey = obfuscateKey(appApiKey, encryptionSalt);
          await supabase
            .from("ttn_connections")
            .update({
              ttn_api_key_encrypted: encryptedAppKey,
              ttn_api_key_last4: getLast4(appApiKey),
              ttn_api_key_id: appApiKeyId,
              ttn_api_key_updated_at: new Date().toISOString(),
              provisioning_step_details: completedSteps,
            })
            .eq("organization_id", organization_id);
        } else {
          console.log(`[ttn-provision-org] [${requestId}] Step 3: Skipping (app key already created)`);
        }

        // ============ STEP 3B: Create Gateway API Key (optional, using Org API Key) ============
        const step3bStart = Date.now();
        if (!completedSteps.gateway_key_attempted) {
          await logProvisioningStep(supabase, organization_id, "create_gateway_key", "started", 
            `Creating gateway API key [optional] (token_source: org_api_key)`, 
            undefined, undefined, requestId);

          console.log(`[ttn-provision-org] [${requestId}] Step 3B: Creating gateway API key for org ${effectiveTtnOrgId} (token_source: org_api_key)`);

          try {
            const createGatewayKeyResponse = await fetchWithTimeout(
              `${IDENTITY_SERVER_URL}/api/v3/organizations/${effectiveTtnOrgId}/api-keys`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${orgApiKeyForAppOps}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: `FrostGuard Gateway Key - ${org.slug}`,
                  rights: GATEWAY_KEY_RIGHTS,
                }),
              }
            );

            if (createGatewayKeyResponse.ok) {
              const gatewayKeyData = await createGatewayKeyResponse.json();
              const gatewayApiKey = gatewayKeyData.key;
              const gatewayApiKeyId = gatewayKeyData.id;

              const duration = Date.now() - step3bStart;
              await logProvisioningStep(supabase, organization_id, "create_gateway_key", "success", "Gateway API key created [output artifact]", { key_last4: getLast4(gatewayApiKey) }, duration, requestId);
              completedSteps.gateway_key_created = true;

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
              console.log(`[ttn-provision-org] [${requestId}] Step 3B: Gateway key creation returned ${createGatewayKeyResponse.status}, continuing...`);
              const duration = Date.now() - step3bStart;
              await logProvisioningStep(supabase, organization_id, "create_gateway_key", "skipped", `Gateway key creation skipped (${createGatewayKeyResponse.status}) - not critical`, { status: createGatewayKeyResponse.status }, duration, requestId);
            }
          } catch (gwErr) {
            const duration = Date.now() - step3bStart;
            const errMsg = gwErr instanceof Error ? gwErr.message : "Unknown error";
            await logProvisioningStep(supabase, organization_id, "create_gateway_key", "skipped", `Gateway key creation failed (${errMsg}) - not critical`, { error: errMsg }, duration, requestId);
            console.log(`[ttn-provision-org] [${requestId}] Step 3B: Gateway key creation failed (not critical): ${errMsg}`);
          }

          completedSteps.gateway_key_attempted = true;
          await supabase
            .from("ttn_connections")
            .update({ provisioning_step_details: completedSteps })
            .eq("organization_id", organization_id);
        } else {
          console.log(`[ttn-provision-org] [${requestId}] Step 3B: Skipping (already attempted)`);
        }

        // ============ STEP 4: Create Webhook (using Org API Key) ============
        const step4Start = Date.now();
        if (!completedSteps.webhook_created) {
          const webhookId = "frostguard-webhook";
          const ttnEndpoint = `${regionalUrl}/api/v3/as/webhooks/${ttnAppId}`;
          await logProvisioningStep(supabase, organization_id, "create_webhook", "started", 
            `Creating webhook (token_source: org_api_key)`, 
            { webhook_url: webhookUrl, endpoint: ttnEndpoint }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "create_webhook" });

          console.log(`[ttn-provision-org] [${requestId}] Step 4: Creating webhook for ${ttnAppId} (token_source: org_api_key)`);

          const webhookSecret = generateWebhookSecret();

          let createWebhookResponse: Response;
          try {
            createWebhookResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${orgApiKeyForAppOps}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  webhook: {
                    ids: {
                      webhook_id: webhookId,
                      application_ids: { application_id: ttnAppId },
                    },
                    base_url: webhookUrl,
                    format: "json",
                    uplink_message: {},
                    join_accept: {},
                    downlink_ack: {},
                    downlink_nack: {},
                    downlink_sent: {},
                    downlink_failed: {},
                    downlink_queued: {},
                    location_solved: {},
                    service_data: {},
                    headers: {
                      "X-Webhook-Secret": webhookSecret,
                    },
                  },
                }),
              }
            );
          } catch (fetchErr) {
            const duration = Date.now() - step4Start;
            const category = classifyError(fetchErr);
            const errMsg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed";
            await logProvisioningStep(supabase, organization_id, "create_webhook", "failed", errMsg, { error: errMsg }, duration, requestId, undefined, undefined, category, ttnEndpoint);
            
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_webhook",
              error: errMsg,
            });
            
            return buildResponse({
              success: false,
              error: errMsg,
              step: "create_webhook",
              retryable: category === "timeout" || category === "network",
              request_id: requestId,
            });
          }

          // Handle 409 (already exists) by trying PUT update
          if (createWebhookResponse.status === 409) {
            console.log(`[ttn-provision-org] [${requestId}] Webhook exists, updating...`);
            const updateEndpoint = `${regionalUrl}/api/v3/as/webhooks/${ttnAppId}/${webhookId}`;
            
            createWebhookResponse = await fetchWithTimeout(
              updateEndpoint,
              {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${orgApiKeyForAppOps}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  webhook: {
                    ids: {
                      webhook_id: webhookId,
                      application_ids: { application_id: ttnAppId },
                    },
                    base_url: webhookUrl,
                    format: "json",
                    uplink_message: {},
                    join_accept: {},
                    headers: {
                      "X-Webhook-Secret": webhookSecret,
                    },
                  },
                  field_mask: {
                    paths: ["base_url", "format", "uplink_message", "join_accept", "headers"],
                  },
                }),
              }
            );
          }

          if (!createWebhookResponse.ok) {
            const errorText = await createWebhookResponse.text();
            const duration = Date.now() - step4Start;
            const category = classifyError(errorText, createWebhookResponse.status);
            const ttnError = parseTTNError(errorText);
            
            await logProvisioningStep(supabase, organization_id, "create_webhook", "failed", `HTTP ${createWebhookResponse.status}`, { status: createWebhookResponse.status }, duration, requestId, createWebhookResponse.status, errorText, category, ttnEndpoint);

            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              step: "create_webhook",
              error: `Failed to create webhook: ${createWebhookResponse.status}`,
              last_http_status: createWebhookResponse.status,
              last_http_body: errorText,
              last_ttn_correlation_id: ttnError.correlation_id,
            });

            return buildResponse({
              success: false,
              error: `Failed to create webhook: ${createWebhookResponse.status}`,
              step: "create_webhook",
              retryable: createWebhookResponse.status >= 500,
              request_id: requestId,
              correlation_id: ttnError.correlation_id,
            });
          }

          const duration = Date.now() - step4Start;
          await logProvisioningStep(supabase, organization_id, "create_webhook", "success", "Webhook created successfully", { webhook_url: webhookUrl }, duration, requestId, createWebhookResponse.status, undefined, undefined, ttnEndpoint);
          completedSteps.webhook_created = true;

          const encryptedWebhookSecret = obfuscateKey(webhookSecret, encryptionSalt);
          await supabase
            .from("ttn_connections")
            .update({
              ttn_webhook_secret_encrypted: encryptedWebhookSecret,
              ttn_webhook_secret_last4: getLast4(webhookSecret),
              ttn_webhook_url: webhookUrl,
              ttn_webhook_id: webhookId,
              provisioning_step_details: completedSteps,
            })
            .eq("organization_id", organization_id);
        } else {
          console.log(`[ttn-provision-org] [${requestId}] Step 4: Skipping (webhook already created)`);
        }

        // ============ STEP 5: Finalize ============
        await logProvisioningStep(supabase, organization_id, "finalize", "success", 
          `Provisioning completed successfully (all steps used token_source: ${TOKEN_SOURCE})`, 
          { ttn_org_id: ttnOrgId, ttn_app_id: ttnAppId }, undefined, requestId);

        await supabase
          .from("ttn_connections")
          .update({
            provisioning_status: "ready",
            provisioning_step: null,
            provisioning_error: null,
            provisioning_completed_at: new Date().toISOString(),
            ttn_application_provisioned_at: new Date().toISOString(),
            provisioning_step_details: completedSteps,
            app_rights_check_status: "ok",
          })
          .eq("organization_id", organization_id);

        console.log(`[ttn-provision-org] [${requestId}] Provisioning complete! All steps used token_source: ${TOKEN_SOURCE}`);

        return buildResponse({
          success: true,
          message: "TTN resources provisioned successfully",
          ttn_organization_id: ttnOrgId,
          ttn_application_id: ttnAppId,
          webhook_url: webhookUrl,
          provisioning_status: "ready",
          app_id_rotated: appIdRotated,
          request_id: requestId,
        });

      } catch (provisionError) {
        const errMsg = provisionError instanceof Error ? provisionError.message : "Unknown provisioning error";
        console.error(`[ttn-provision-org] [${requestId}] Provisioning failed:`, errMsg);

        return buildResponse({
          success: false,
          error: errMsg,
          retryable: true,
          request_id: requestId,
        });
      }
    }

    // ========================================
    // ACTION: DELETE
    // ========================================
    if (action === "delete") {
      if (!ttnConn?.ttn_organization_id) {
        return buildResponse({
          success: true,
          message: "No TTN resources to delete",
          request_id: requestId,
        });
      }

      const ttnOrgId = ttnConn.ttn_organization_id;
      const ttnAppId = ttnConn.ttn_application_id;

      console.log(`[ttn-provision-org] [${requestId}] Deleting TTN resources: org=${ttnOrgId}, app=${ttnAppId} (token_source: ${TOKEN_SOURCE})`);

      // Delete application first (if exists)
      if (ttnAppId) {
        try {
          const deleteAppResponse = await fetchWithTimeout(
            `${IDENTITY_SERVER_URL}/api/v3/applications/${ttnAppId}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${ttnAdminKey}` },
            }
          );
          console.log(`[ttn-provision-org] [${requestId}] Delete app response: ${deleteAppResponse.status}`);
        } catch (err) {
          console.log(`[ttn-provision-org] [${requestId}] Delete app failed (may not exist):`, err);
        }
      }

      // Delete organization
      try {
        const deleteOrgResponse = await fetchWithTimeout(
          `${IDENTITY_SERVER_URL}/api/v3/organizations/${ttnOrgId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${ttnAdminKey}` },
          }
        );
        console.log(`[ttn-provision-org] [${requestId}] Delete org response: ${deleteOrgResponse.status}`);
      } catch (err) {
        console.log(`[ttn-provision-org] [${requestId}] Delete org failed (may not exist):`, err);
      }

      // Clear database
      await supabase
        .from("ttn_connections")
        .update({
          ttn_organization_id: null,
          ttn_organization_name: null,
          ttn_application_id: null,
          ttn_application_name: null,
          ttn_org_api_key_encrypted: null,
          ttn_api_key_encrypted: null,
          ttn_webhook_secret_encrypted: null,
          provisioning_status: "idle",
          provisioning_step: null,
          provisioning_error: null,
          provisioning_step_details: null,
          app_rights_check_status: null,
        })
        .eq("organization_id", organization_id);

      await logProvisioningStep(supabase, organization_id, "delete", "success", 
        `TTN resources deleted (token_source: ${TOKEN_SOURCE})`, 
        { ttn_org_id: ttnOrgId, ttn_app_id: ttnAppId }, undefined, requestId);

      return buildResponse({
        success: true,
        message: "TTN resources deleted",
        request_id: requestId,
      });
    }

    // ========================================
    // ACTION: REGENERATE_WEBHOOK_SECRET
    // ========================================
    if (action === "regenerate_webhook_secret") {
      if (!ttnConn?.ttn_application_id) {
        return buildResponse({
          success: false,
          error: "No TTN application provisioned",
          request_id: requestId,
          retryable: false,
        });
      }

      const ttnAppId = ttnConn.ttn_application_id;
      const webhookId = ttnConn.ttn_webhook_id || "frostguard-webhook";
      const regionalUrl = REGIONAL_URLS[ttnConn.ttn_region || "eu1"] || REGIONAL_URLS.eu1;

      console.log(`[ttn-provision-org] [${requestId}] Regenerating webhook secret for ${ttnAppId} (token_source: ${TOKEN_SOURCE})`);

      const newWebhookSecret = generateWebhookSecret();

      const updateWebhookResponse = await fetchWithTimeout(
        `${regionalUrl}/api/v3/as/webhooks/${ttnAppId}/${webhookId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${ttnAdminKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            webhook: {
              ids: {
                webhook_id: webhookId,
                application_ids: { application_id: ttnAppId },
              },
              headers: {
                "X-Webhook-Secret": newWebhookSecret,
              },
            },
            field_mask: {
              paths: ["headers"],
            },
          }),
        }
      );

      if (!updateWebhookResponse.ok) {
        const errorText = await updateWebhookResponse.text();
        return buildResponse({
          success: false,
          error: `Failed to update webhook: ${updateWebhookResponse.status}`,
          details: errorText,
          request_id: requestId,
          retryable: updateWebhookResponse.status >= 500,
        });
      }

      const encryptedSecret = obfuscateKey(newWebhookSecret, encryptionSalt);
      await supabase
        .from("ttn_connections")
        .update({
          ttn_webhook_secret_encrypted: encryptedSecret,
          ttn_webhook_secret_last4: getLast4(newWebhookSecret),
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organization_id);

      await logProvisioningStep(supabase, organization_id, "regenerate_webhook_secret", "success", 
        `Webhook secret regenerated (token_source: ${TOKEN_SOURCE})`, 
        { secret_last4: getLast4(newWebhookSecret) }, undefined, requestId);

      return buildResponse({
        success: true,
        message: "Webhook secret regenerated",
        secret_last4: getLast4(newWebhookSecret),
        request_id: requestId,
      });
    }

    // Unknown action
    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}`, request_id: requestId }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[ttn-provision-org] [${requestId}] Unhandled error:`, errMsg);

    return buildResponse({
      success: false,
      error: errMsg,
      retryable: true,
      request_id: requestId,
    });
  }
});
