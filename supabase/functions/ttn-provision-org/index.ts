/**
 * TTN Organization Provisioning Edge Function
 * 
 * ARCHITECTURE: Single User API Key Model
 * =========================================
 * ALL provisioning operations use the SAME Main User API Key (TTN_ADMIN_API_KEY).
 * Created Org/App API keys are OUTPUT ARTIFACTS for runtime use, NOT inputs to provisioning.
 * 
 * This eliminates the "no_application_rights" 403 error that occurred when
 * switching to newly-created org API keys mid-provisioning.
 * 
 * PROVISIONING STEPS:
 * - Step 0: Preflight - Validate Main User API Key has required rights
 * - Step 1: Create TTN Organization (idempotent) - uses TTN_ADMIN_API_KEY
 * - Step 1B: Create Org API Key (output artifact for runtime) - uses TTN_ADMIN_API_KEY
 * - Step 2: Create TTN Application (idempotent) - uses TTN_ADMIN_API_KEY
 * - Step 3: Create App API Key (output artifact for runtime) - uses TTN_ADMIN_API_KEY
 * - Step 3B: Create Gateway API Key (optional, output artifact) - uses TTN_ADMIN_API_KEY
 * - Step 4: Create/Update Webhook - uses TTN_ADMIN_API_KEY
 * 
 * All steps use TTN_ADMIN_API_KEY. All logs include token_source for audit.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateTtnApplicationId,
  generateTtnOrganizationId,
  generateWebhookSecret,
  obfuscateKey,
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
  action: "provision" | "status" | "delete" | "regenerate_webhook_secret" | "retry";
  organization_id: string;
  ttn_region?: string;
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
  }
  if (patch.last_http_body !== undefined) {
    updateData.last_http_body = patch.last_http_body?.slice(0, 2000);
  }

  await supabase
    .from("ttn_connections")
    .update(updateData)
    .eq("organization_id", organizationId);
}

serve(async (req) => {
  const BUILD_VERSION = "ttn-provision-org-v3.0-single-credential-model-20260104";
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
        architecture: "single-credential-model-v3",
        token_source: TOKEN_SOURCE,
        steps: [
          "0: Preflight - Validate Main User API Key",
          "1: Create Organization (using Main User API Key)",
          "1B: Create Org API Key [output artifact] (using Main User API Key)",
          "2: Create Application (using Main User API Key)",
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
      return new Response(
        JSON.stringify({ success: false, error: "Missing Supabase credentials", request_id: requestId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ttnAdminKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "TTN_ADMIN_API_KEY not configured",
          hint: "Add the Main User API Key (Personal API Key with full rights) as a secret in the project settings",
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

      return new Response(
        JSON.stringify({
          success: true,
          request_id: requestId,
          provisioning_status: statusValue,
          provisioning_step: ttnConn?.provisioning_step || null,
          provisioning_error: ttnConn?.provisioning_error || null,
          last_http_status: ttnConn?.last_http_status || null,
          last_http_body: ttnConn?.last_http_body || null,
          // TTN Organization info
          ttn_organization_id: ttnConn?.ttn_organization_id || null,
          ttn_organization_name: ttnConn?.ttn_organization_name || null,
          has_org_api_key: !!ttnConn?.ttn_org_api_key_encrypted,
          // TTN Application info
          ttn_application_id: ttnConn?.ttn_application_id || null,
          ttn_region: ttnConn?.ttn_region || "eu1",
          has_app_api_key: !!ttnConn?.ttn_api_key_encrypted,
          has_webhook_secret: !!ttnConn?.ttn_webhook_secret_encrypted,
          webhook_url: ttnConn?.ttn_webhook_url || null,
          provisioned_at: ttnConn?.ttn_application_provisioned_at || null,
          token_source: TOKEN_SOURCE,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // ACTION: PROVISION or RETRY
    // ========================================
    if (action === "provision" || action === "retry") {
      // Check if already provisioned (only for fresh provision)
      if (
        action === "provision" &&
        ttnConn?.ttn_application_id &&
        (ttnConn.provisioning_status === "completed" || ttnConn.provisioning_status === "ready")
      ) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "TTN application already provisioned",
            ttn_organization_id: ttnConn.ttn_organization_id,
            ttn_application_id: ttnConn.ttn_application_id,
            provisioning_status: "ready",
            request_id: requestId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate TTN organization and application IDs from org UUID
      const ttnOrgId = generateTtnOrganizationId(org.id);
      const ttnAppId = generateTtnApplicationId(org.id);
      console.log(`[ttn-provision-org] [${requestId}] Provisioning TTN org: ${ttnOrgId}, app: ${ttnAppId} for org ${org.slug}`);
      console.log(`[ttn-provision-org] [${requestId}] ALL STEPS will use token_source: ${TOKEN_SOURCE}`);

      // Track completed steps for idempotency
      const completedSteps: Record<string, unknown> = ttnConn?.provisioning_step_details || {};

      // Ensure absolute webhook URL
      const webhookUrl = supabaseUrl.startsWith("http")
        ? `${supabaseUrl}/functions/v1/ttn-webhook`
        : `https://${supabaseUrl}/functions/v1/ttn-webhook`;
      const regionalUrl = REGIONAL_URLS[region] || REGIONAL_URLS.eu1;

      // Initialize or update ttn_connections record
      if (ttnConn) {
        await supabase
          .from("ttn_connections")
          .update({
            ttn_region: region,
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
        const step0Start = Date.now();
        if (!completedSteps.preflight_done) {
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
            
            throw new Error(preflightResult.error || "Preflight validation failed");
          }

          const duration = Date.now() - step0Start;
          await logProvisioningStep(supabase, organization_id, "preflight", "success", 
            `Main User API Key verified (user: ${preflightResult.user_id}, is_admin: ${preflightResult.is_admin})`, 
            { user_id: preflightResult.user_id, is_admin: preflightResult.is_admin }, 
            duration, requestId, undefined, undefined, undefined, ttnEndpoint);
          completedSteps.preflight_done = true;
          completedSteps.preflight_user_id = preflightResult.user_id;

          await supabase
            .from("ttn_connections")
            .update({ provisioning_step_details: completedSteps })
            .eq("organization_id", organization_id);
        }

        // ============ STEP 1: Create TTN Organization (using Main User API Key) ============
        const step1Start = Date.now();
        if (!completedSteps.organization_created) {
          const ttnEndpoint = `${IDENTITY_SERVER_URL}/api/v3/users/${ttnUserId}/organizations`;
          await logProvisioningStep(supabase, organization_id, "create_organization", "started", 
            `Creating TTN organization (token_source: ${TOKEN_SOURCE})`, 
            { ttn_org_id: ttnOrgId, endpoint: ttnEndpoint }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "create_ttn_org" });

          console.log(`[ttn-provision-org] [${requestId}] Step 1: Creating TTN organization ${ttnOrgId} (token_source: ${TOKEN_SOURCE})`);

          let createOrgResponse: Response;
          try {
            createOrgResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ttnAdminKey}`, // ALWAYS use Main User API Key
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  organization: {
                    ids: { organization_id: ttnOrgId },
                    name: `FrostGuard - ${org.name}`,
                    description: `FrostGuard temperature monitoring organization for ${org.name}`,
                  },
                }),
              }
            );
          } catch (fetchErr) {
            const duration = Date.now() - step1Start;
            const category = classifyError(fetchErr);
            const errMsg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed";
            await logProvisioningStep(supabase, organization_id, "create_organization", "failed", errMsg, { error: errMsg }, duration, requestId, undefined, undefined, category, ttnEndpoint);
            throw fetchErr;
          }

          if (!createOrgResponse.ok && createOrgResponse.status !== 409) {
            const errorText = await createOrgResponse.text();
            const duration = Date.now() - step1Start;
            const category = classifyError(errorText, createOrgResponse.status);
            await logProvisioningStep(supabase, organization_id, "create_organization", "failed", `HTTP ${createOrgResponse.status}`, { status: createOrgResponse.status }, duration, requestId, createOrgResponse.status, errorText, category, ttnEndpoint);
            throw new Error(`Failed to create TTN organization: ${createOrgResponse.status} - ${errorText}`);
          }

          const duration = Date.now() - step1Start;
          await logProvisioningStep(supabase, organization_id, "create_organization", "success", "TTN organization created", { ttn_org_id: ttnOrgId }, duration, requestId, createOrgResponse.status, undefined, undefined, ttnEndpoint);
          completedSteps.organization_created = true;

          // Save progress immediately
          await supabase
            .from("ttn_connections")
            .update({
              ttn_organization_id: ttnOrgId,
              ttn_organization_name: `FrostGuard - ${org.name}`,
              ttn_organization_provisioned_at: new Date().toISOString(),
              provisioning_step_details: completedSteps,
            })
            .eq("organization_id", organization_id);
        } else {
          console.log(`[ttn-provision-org] [${requestId}] Step 1: Skipping (org already created)`);
        }

        // ============ STEP 1B: Create Org-scoped API Key (using Main User API Key) ============
        const step1bStart = Date.now();
        if (!completedSteps.org_api_key_created) {
          const ttnEndpoint = `${IDENTITY_SERVER_URL}/api/v3/organizations/${ttnOrgId}/api-keys`;
          await logProvisioningStep(supabase, organization_id, "create_org_api_key", "started", 
            `Creating organization API key [output artifact] (token_source: ${TOKEN_SOURCE})`, 
            { endpoint: ttnEndpoint }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "create_org_api_key" });

          console.log(`[ttn-provision-org] [${requestId}] Step 1B: Creating org-scoped API key for ${ttnOrgId} (token_source: ${TOKEN_SOURCE})`);

          let createOrgKeyResponse: Response;
          try {
            createOrgKeyResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ttnAdminKey}`, // ALWAYS use Main User API Key
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
            throw fetchErr;
          }

          if (!createOrgKeyResponse.ok) {
            const errorText = await createOrgKeyResponse.text();
            const duration = Date.now() - step1bStart;
            const category = classifyError(errorText, createOrgKeyResponse.status);
            await logProvisioningStep(supabase, organization_id, "create_org_api_key", "failed", `HTTP ${createOrgKeyResponse.status}`, { status: createOrgKeyResponse.status }, duration, requestId, createOrgKeyResponse.status, errorText, category, ttnEndpoint);

            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              error: `Failed to create organization API key: ${createOrgKeyResponse.status}`,
              last_http_status: createOrgKeyResponse.status,
              last_http_body: errorText,
            });

            throw new Error(`Failed to create org API key: ${createOrgKeyResponse.status} - ${errorText}`);
          }

          const orgKeyData = await createOrgKeyResponse.json();
          const orgApiKey = orgKeyData.key;
          const orgApiKeyId = orgKeyData.id;

          const duration = Date.now() - step1bStart;
          await logProvisioningStep(supabase, organization_id, "create_org_api_key", "success", "Organization API key created [output artifact]", { key_last4: getLast4(orgApiKey) }, duration, requestId, createOrgKeyResponse.status, undefined, undefined, ttnEndpoint);
          completedSteps.org_api_key_created = true;

          // Save org API key immediately (output artifact for runtime use)
          const encryptedOrgKey = obfuscateKey(orgApiKey, encryptionSalt);
          await supabase
            .from("ttn_connections")
            .update({
              ttn_org_api_key_encrypted: encryptedOrgKey,
              ttn_org_api_key_last4: getLast4(orgApiKey),
              ttn_org_api_key_id: orgApiKeyId,
              provisioning_step_details: completedSteps,
            })
            .eq("organization_id", organization_id);
        } else {
          console.log(`[ttn-provision-org] [${requestId}] Step 1B: Skipping (org key already created)`);
        }

        // ============ STEP 2: Create Application under Organization (using Main User API Key) ============
        const step2Start = Date.now();
        if (!completedSteps.application_created) {
          const ttnEndpoint = `${IDENTITY_SERVER_URL}/api/v3/organizations/${ttnOrgId}/applications`;
          await logProvisioningStep(supabase, organization_id, "create_application", "started", 
            `Creating TTN application under organization (token_source: ${TOKEN_SOURCE})`, 
            { ttn_app_id: ttnAppId, ttn_org_id: ttnOrgId, endpoint: ttnEndpoint }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "create_application" });

          console.log(`[ttn-provision-org] [${requestId}] Step 2: Creating application ${ttnAppId} under org ${ttnOrgId} (token_source: ${TOKEN_SOURCE})`);

          let createAppResponse: Response;
          try {
            createAppResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ttnAdminKey}`, // ALWAYS use Main User API Key
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
            throw fetchErr;
          }

          if (!createAppResponse.ok && createAppResponse.status !== 409) {
            const errorText = await createAppResponse.text();
            const duration = Date.now() - step2Start;
            const category = classifyError(errorText, createAppResponse.status);
            await logProvisioningStep(supabase, organization_id, "create_application", "failed", `HTTP ${createAppResponse.status}`, { status: createAppResponse.status }, duration, requestId, createAppResponse.status, errorText, category, ttnEndpoint);
            throw new Error(`Failed to create application: ${createAppResponse.status} - ${errorText}`);
          }

          const duration = Date.now() - step2Start;
          await logProvisioningStep(supabase, organization_id, "create_application", "success", "TTN application created under organization", { ttn_app_id: ttnAppId, ttn_org_id: ttnOrgId }, duration, requestId, createAppResponse.status, undefined, undefined, ttnEndpoint);
          completedSteps.application_created = true;

          // Save progress immediately
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

        // ============ STEP 3: Create App-scoped API Key (using Main User API Key) ============
        const step3Start = Date.now();
        if (!completedSteps.app_api_key_created) {
          const ttnEndpoint = `${IDENTITY_SERVER_URL}/api/v3/applications/${ttnAppId}/api-keys`;
          await logProvisioningStep(supabase, organization_id, "create_app_api_key", "started", 
            `Creating application API key [output artifact] (token_source: ${TOKEN_SOURCE})`, 
            { endpoint: ttnEndpoint }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "create_app_api_key" });

          console.log(`[ttn-provision-org] [${requestId}] Step 3: Creating app-scoped API key for ${ttnAppId} (token_source: ${TOKEN_SOURCE})`);

          let createAppKeyResponse: Response;
          try {
            createAppKeyResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ttnAdminKey}`, // ALWAYS use Main User API Key
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
            throw fetchErr;
          }

          if (!createAppKeyResponse.ok) {
            const errorText = await createAppKeyResponse.text();
            const duration = Date.now() - step3Start;
            const category = classifyError(errorText, createAppKeyResponse.status);

            await logProvisioningStep(supabase, organization_id, "create_app_api_key", "failed", `HTTP ${createAppKeyResponse.status}`, {
              status: createAppKeyResponse.status,
            }, duration, requestId, createAppKeyResponse.status, errorText, category, ttnEndpoint);

            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              error: `Failed to create application API key: ${createAppKeyResponse.status}`,
              last_http_status: createAppKeyResponse.status,
              last_http_body: errorText,
            });

            throw new Error(`Failed to create app API key: ${createAppKeyResponse.status} - ${errorText}`);
          }

          const appKeyData = await createAppKeyResponse.json();
          const appApiKey = appKeyData.key;
          const appApiKeyId = appKeyData.id;

          const duration = Date.now() - step3Start;
          await logProvisioningStep(supabase, organization_id, "create_app_api_key", "success", "Application API key created [output artifact]", { key_last4: getLast4(appApiKey) }, duration, requestId, createAppKeyResponse.status, undefined, undefined, ttnEndpoint);
          completedSteps.app_api_key_created = true;

          // Save app API key (output artifact for runtime use)
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

        // ============ STEP 3B: Create Gateway API Key (optional, using Main User API Key) ============
        const step3bStart = Date.now();
        if (!completedSteps.gateway_key_attempted) {
          await logProvisioningStep(supabase, organization_id, "create_gateway_key", "started", 
            `Creating gateway API key [optional output artifact] (token_source: ${TOKEN_SOURCE})`, 
            undefined, undefined, requestId);

          console.log(`[ttn-provision-org] [${requestId}] Step 3B: Creating gateway API key for org ${ttnOrgId} (token_source: ${TOKEN_SOURCE})`);

          try {
            const createGatewayKeyResponse = await fetchWithTimeout(
              `${IDENTITY_SERVER_URL}/api/v3/organizations/${ttnOrgId}/api-keys`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ttnAdminKey}`, // ALWAYS use Main User API Key
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

              // Save gateway key
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

        // ============ STEP 4: Create Webhook (using Main User API Key) ============
        const step4Start = Date.now();
        if (!completedSteps.webhook_created) {
          const webhookId = "frostguard-webhook";
          const ttnEndpoint = `${regionalUrl}/api/v3/as/webhooks/${ttnAppId}`;
          await logProvisioningStep(supabase, organization_id, "create_webhook", "started", 
            `Creating webhook (token_source: ${TOKEN_SOURCE})`, 
            { webhook_url: webhookUrl, endpoint: ttnEndpoint }, undefined, requestId, undefined, undefined, undefined, ttnEndpoint);
          await updateProvisioningState(supabase, organization_id, { step: "create_webhook" });

          console.log(`[ttn-provision-org] [${requestId}] Step 4: Creating webhook for ${ttnAppId} (token_source: ${TOKEN_SOURCE})`);

          // Generate new webhook secret
          const webhookSecret = generateWebhookSecret();

          let createWebhookResponse: Response;
          try {
            createWebhookResponse = await fetchWithTimeout(
              ttnEndpoint,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ttnAdminKey}`, // ALWAYS use Main User API Key
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
            throw fetchErr;
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
                  Authorization: `Bearer ${ttnAdminKey}`, // ALWAYS use Main User API Key
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
            await logProvisioningStep(supabase, organization_id, "create_webhook", "failed", `HTTP ${createWebhookResponse.status}`, { status: createWebhookResponse.status }, duration, requestId, createWebhookResponse.status, errorText, category, ttnEndpoint);

            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              error: `Failed to create webhook: ${createWebhookResponse.status}`,
              last_http_status: createWebhookResponse.status,
              last_http_body: errorText,
            });

            throw new Error(`Failed to create webhook: ${createWebhookResponse.status} - ${errorText}`);
          }

          const duration = Date.now() - step4Start;
          await logProvisioningStep(supabase, organization_id, "create_webhook", "success", "Webhook created successfully", { webhook_url: webhookUrl }, duration, requestId, createWebhookResponse.status, undefined, undefined, ttnEndpoint);
          completedSteps.webhook_created = true;

          // Save webhook secret
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

        // Mark as complete
        await supabase
          .from("ttn_connections")
          .update({
            provisioning_status: "ready",
            provisioning_step: null,
            provisioning_error: null,
            provisioning_completed_at: new Date().toISOString(),
            ttn_application_provisioned_at: new Date().toISOString(),
            provisioning_step_details: completedSteps,
          })
          .eq("organization_id", organization_id);

        console.log(`[ttn-provision-org] [${requestId}] Provisioning complete! All steps used token_source: ${TOKEN_SOURCE}`);

        return new Response(
          JSON.stringify({
            success: true,
            message: "TTN resources provisioned successfully",
            ttn_organization_id: ttnOrgId,
            ttn_application_id: ttnAppId,
            webhook_url: webhookUrl,
            provisioning_status: "ready",
            token_source: TOKEN_SOURCE,
            request_id: requestId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } catch (provisionError) {
        const errMsg = provisionError instanceof Error ? provisionError.message : "Unknown provisioning error";
        console.error(`[ttn-provision-org] [${requestId}] Provisioning failed:`, errMsg);

        return new Response(
          JSON.stringify({
            success: false,
            error: errMsg,
            request_id: requestId,
            token_source: TOKEN_SOURCE,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========================================
    // ACTION: DELETE (unchanged - uses Main User API Key)
    // ========================================
    if (action === "delete") {
      if (!ttnConn?.ttn_organization_id) {
        return new Response(
          JSON.stringify({ success: true, message: "No TTN resources to delete", request_id: requestId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
              headers: {
                Authorization: `Bearer ${ttnAdminKey}`, // ALWAYS use Main User API Key
              },
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
            headers: {
              Authorization: `Bearer ${ttnAdminKey}`, // ALWAYS use Main User API Key
            },
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
        })
        .eq("organization_id", organization_id);

      await logProvisioningStep(supabase, organization_id, "delete", "success", 
        `TTN resources deleted (token_source: ${TOKEN_SOURCE})`, 
        { ttn_org_id: ttnOrgId, ttn_app_id: ttnAppId }, undefined, requestId);

      return new Response(
        JSON.stringify({ success: true, message: "TTN resources deleted", request_id: requestId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // ACTION: REGENERATE_WEBHOOK_SECRET
    // ========================================
    if (action === "regenerate_webhook_secret") {
      if (!ttnConn?.ttn_application_id) {
        return new Response(
          JSON.stringify({ success: false, error: "No TTN application provisioned", request_id: requestId }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
            Authorization: `Bearer ${ttnAdminKey}`, // ALWAYS use Main User API Key
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
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to update webhook: ${updateWebhookResponse.status}`,
            details: errorText,
            request_id: requestId,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save new secret
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

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Webhook secret regenerated",
          secret_last4: getLast4(newWebhookSecret),
          request_id: requestId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown action
    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}`, request_id: requestId }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[ttn-provision-org] [${requestId}] Unhandled error:`, errMsg);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errMsg,
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
