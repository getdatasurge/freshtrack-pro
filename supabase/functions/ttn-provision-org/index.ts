/**
 * TTN Organization Provisioning Edge Function
 *
 * CORRECT PROVISIONING ARCHITECTURE:
 * Step 0: Preflight - Verify master API key has full user rights
 * Step 1: Create TTN Organization per customer
 * Step 1B: Create ORG-SCOPED API key (replaces master key for org operations)
 * Step 2: Create Application under org (using ORG key)
 * Step 3: Create APP-SCOPED API key (using ORG key)
 * Step 3B: Create Gateway API key (optional, using ORG key)
 * Step 4: Create Webhook (using APP API KEY - CRITICAL!)
 * Step 5: Finalize
 *
 * Security:
 * - Master API key (TTN_ADMIN_API_KEY) only used for org creation
 * - Org-scoped key used for app/gateway creation
 * - App-scoped key used for webhook management and runtime
 * - Each customer gets isolated TTN resources
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateTtnApplicationId,
  generateTtnOrganizationId,
  generateWebhookSecret,
  obfuscateKey,
  deobfuscateKey,
  getLast4,
} from "../_shared/ttnConfig.ts";
import {
  APPLICATION_KEY_RIGHTS,
  ORGANIZATION_KEY_RIGHTS,
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
  from_step?: string;
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
  ttnResponseBody?: string
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
      ttn_response_body: ttnResponseBody?.slice(0, 2000) || null,
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

  await supabase
    .from("ttn_connections")
    .update(updateData)
    .eq("organization_id", organizationId);
}

serve(async (req) => {
  const BUILD_VERSION = "ttn-provision-org-v2.0-org-flow-20260104";
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[ttn-provision-org] [${requestId}] Build: ${BUILD_VERSION}`);

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
        architecture: "organization-based-v2",
        steps: [
          "0: Preflight",
          "1: Create Organization",
          "1B: Create Org API Key",
          "2: Create Application",
          "3: Create App API Key",
          "3B: Create Gateway Key (optional)",
          "4: Create Webhook",
          "5: Finalize",
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
          ttn_organization_id: ttnConn?.ttn_organization_id || null,
          ttn_application_id: ttnConn?.ttn_application_id || null,
          ttn_region: ttnConn?.ttn_region || "nam1",
          has_org_api_key: !!ttnConn?.ttn_org_api_key_encrypted,
          has_app_api_key: !!ttnConn?.ttn_api_key_encrypted,
          has_webhook_secret: !!ttnConn?.ttn_webhook_secret_encrypted,
          webhook_url: ttnConn?.ttn_webhook_url || null,
          provisioned_at: ttnConn?.ttn_application_provisioned_at || null,
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

      // Generate IDs
      const ttnOrgId = generateTtnOrganizationId(org.id);
      const ttnAppId = generateTtnApplicationId(org.id);
      console.log(`[ttn-provision-org] [${requestId}] Provisioning TTN org: ${ttnOrgId}, app: ${ttnAppId}`);

      // Track completed steps for idempotency
      const completedSteps: Record<string, unknown> = ttnConn?.provisioning_step_details || {};

      // Ensure absolute webhook URL
      const webhookUrl = supabaseUrl.startsWith("http")
        ? `${supabaseUrl}/functions/v1/ttn-webhook`
        : `https://${supabaseUrl}/functions/v1/ttn-webhook`;
      const regionalUrl = REGIONAL_URLS[region] || REGIONAL_URLS.nam1;

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

      // Variables to store created resources
      let orgApiKey = "";
      let orgApiKeyId = "";
      let appApiKey = "";
      let appApiKeyId = "";
      let webhookSecret = "";

      try {
        // ============ STEP 0: Preflight - Verify admin key ============
        const step0Start = Date.now();
        if (!completedSteps.preflight_done) {
          await logProvisioningStep(supabase, organization_id, "preflight", "started", "Verifying TTN admin credentials", undefined, undefined, requestId);
          await updateProvisioningState(supabase, organization_id, { step: "preflight" });

          console.log(`[ttn-provision-org] [${requestId}] Step 0: Preflight check`);

          const authInfoResponse = await fetchWithTimeout(`${IDENTITY_SERVER_URL}/api/v3/auth_info`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${ttnAdminKey}`,
              Accept: "application/json",
            },
          });

          if (!authInfoResponse.ok) {
            const errorText = await authInfoResponse.text();
            const duration = Date.now() - step0Start;
            await logProvisioningStep(supabase, organization_id, "preflight", "failed", `Admin key validation failed: HTTP ${authInfoResponse.status}`, undefined, duration, requestId, authInfoResponse.status, errorText);
            await updateProvisioningState(supabase, organization_id, {
              status: "failed",
              error: `TTN admin key is invalid or expired (HTTP ${authInfoResponse.status})`,
            });
            throw new Error(`TTN admin key validation failed: ${authInfoResponse.status}`);
          }

          const duration = Date.now() - step0Start;
          await logProvisioningStep(supabase, organization_id, "preflight", "success", "Admin credentials verified", undefined, duration, requestId);
          completedSteps.preflight_done = true;

          await supabase
            .from("ttn_connections")
            .update({ provisioning_step_details: completedSteps })
            .eq("organization_id", organization_id);
        }

        // ============ STEP 1: Create TTN Organization ============
        const step1Start = Date.now();
        if (!completedSteps.organization_created) {
          await logProvisioningStep(supabase, organization_id, "create_organization", "started", "Creating TTN organization", { ttn_org_id: ttnOrgId }, undefined, requestId);
          await updateProvisioningState(supabase, organization_id, { step: "create_organization" });

          console.log(`[ttn-provision-org] [${requestId}] Step 1: Creating TTN organization ${ttnOrgId}`);

          const createOrgResponse = await fetchWithTimeout(
            `${IDENTITY_SERVER_URL}/api/v3/users/${ttnUserId}/organizations`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${ttnAdminKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                organization: {
                  ids: { organization_id: ttnOrgId },
                  name: `FreshTracker - ${org.name}`,
                  description: `FreshTracker organization for ${org.name}`,
                },
              }),
            }
          );

          if (!createOrgResponse.ok && createOrgResponse.status !== 409) {
            const errorText = await createOrgResponse.text();
            const duration = Date.now() - step1Start;
            await logProvisioningStep(supabase, organization_id, "create_organization", "failed", `HTTP ${createOrgResponse.status}`, undefined, duration, requestId, createOrgResponse.status, errorText);
            throw new Error(`Failed to create organization: ${createOrgResponse.status} - ${errorText}`);
          }

          const duration = Date.now() - step1Start;
          await logProvisioningStep(supabase, organization_id, "create_organization", "success", "TTN organization created", { ttn_org_id: ttnOrgId }, duration, requestId, createOrgResponse.status);
          completedSteps.organization_created = true;

          // Save progress
          await supabase
            .from("ttn_connections")
            .update({
              ttn_organization_id: ttnOrgId,
              ttn_organization_provisioned_at: new Date().toISOString(),
              provisioning_step_details: completedSteps,
            })
            .eq("organization_id", organization_id);
        } else {
          console.log(`[ttn-provision-org] [${requestId}] Step 1: Skipping (org already created)`);
        }

        // ============ STEP 1B: Create Org-scoped API Key ============
        const step1bStart = Date.now();
        if (!completedSteps.org_api_key_created) {
          await logProvisioningStep(supabase, organization_id, "create_org_api_key", "started", "Creating organization API key", undefined, undefined, requestId);
          await updateProvisioningState(supabase, organization_id, { step: "create_org_api_key" });

          console.log(`[ttn-provision-org] [${requestId}] Step 1B: Creating org-scoped API key for ${ttnOrgId}`);

          const createOrgKeyResponse = await fetchWithTimeout(
            `${IDENTITY_SERVER_URL}/api/v3/organizations/${ttnOrgId}/api-keys`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${ttnAdminKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: `FreshTracker Org Key - ${org.slug}`,
                rights: ORGANIZATION_KEY_RIGHTS,
              }),
            }
          );

          if (!createOrgKeyResponse.ok) {
            const errorText = await createOrgKeyResponse.text();
            const duration = Date.now() - step1bStart;
            await logProvisioningStep(supabase, organization_id, "create_org_api_key", "failed", `HTTP ${createOrgKeyResponse.status}`, undefined, duration, requestId, createOrgKeyResponse.status, errorText);
            throw new Error(`Failed to create org API key: ${createOrgKeyResponse.status} - ${errorText}`);
          }

          const orgKeyData = await createOrgKeyResponse.json();
          orgApiKey = orgKeyData.key;
          orgApiKeyId = orgKeyData.id;

          const duration = Date.now() - step1bStart;
          await logProvisioningStep(supabase, organization_id, "create_org_api_key", "success", "Organization API key created", { key_last4: getLast4(orgApiKey) }, duration, requestId);
          completedSteps.org_api_key_created = true;

          // Save org API key
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
          // Retrieve existing org API key for subsequent steps
          if (ttnConn?.ttn_org_api_key_encrypted) {
            orgApiKey = deobfuscateKey(ttnConn.ttn_org_api_key_encrypted, encryptionSalt);
          }
          console.log(`[ttn-provision-org] [${requestId}] Step 1B: Skipping (org key already created)`);
        }

        // Ensure we have org API key for subsequent steps
        if (!orgApiKey) {
          throw new Error("Org API key not available - cannot proceed with application creation");
        }

        // ============ STEP 2: Create Application under Organization (using ORG key) ============
        const step2Start = Date.now();
        if (!completedSteps.application_created) {
          await logProvisioningStep(supabase, organization_id, "create_application", "started", "Creating TTN application", { ttn_app_id: ttnAppId }, undefined, requestId);
          await updateProvisioningState(supabase, organization_id, { step: "create_application" });

          console.log(`[ttn-provision-org] [${requestId}] Step 2: Creating application ${ttnAppId} under org ${ttnOrgId} (using ORG key)`);

          const createAppResponse = await fetchWithTimeout(
            `${IDENTITY_SERVER_URL}/api/v3/organizations/${ttnOrgId}/applications`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${orgApiKey}`,
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

          if (!createAppResponse.ok && createAppResponse.status !== 409) {
            const errorText = await createAppResponse.text();
            const duration = Date.now() - step2Start;
            await logProvisioningStep(supabase, organization_id, "create_application", "failed", `HTTP ${createAppResponse.status}`, undefined, duration, requestId, createAppResponse.status, errorText);
            throw new Error(`Failed to create application: ${createAppResponse.status} - ${errorText}`);
          }

          const duration = Date.now() - step2Start;
          await logProvisioningStep(supabase, organization_id, "create_application", "success", "TTN application created", { ttn_app_id: ttnAppId }, duration, requestId, createAppResponse.status);
          completedSteps.application_created = true;

          // Save progress
          await supabase
            .from("ttn_connections")
            .update({
              ttn_application_id: ttnAppId,
              ttn_application_name: `FreshTracker - ${org.name}`,
              provisioning_step_details: completedSteps,
            })
            .eq("organization_id", organization_id);
        } else {
          console.log(`[ttn-provision-org] [${requestId}] Step 2: Skipping (app already created)`);
        }

        // ============ STEP 3: Create App-scoped API Key (using ORG key) ============
        const step3Start = Date.now();
        if (!completedSteps.app_api_key_created) {
          await logProvisioningStep(supabase, organization_id, "create_app_api_key", "started", "Creating application API key", undefined, undefined, requestId);
          await updateProvisioningState(supabase, organization_id, { step: "create_app_api_key" });

          console.log(`[ttn-provision-org] [${requestId}] Step 3: Creating app-scoped API key for ${ttnAppId} (using ORG key)`);

          const createAppKeyResponse = await fetchWithTimeout(
            `${IDENTITY_SERVER_URL}/api/v3/applications/${ttnAppId}/api-keys`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${orgApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: "FreshTracker Integration",
                rights: APPLICATION_KEY_RIGHTS,
              }),
            }
          );

          if (!createAppKeyResponse.ok) {
            const errorText = await createAppKeyResponse.text();
            const duration = Date.now() - step3Start;
            await logProvisioningStep(supabase, organization_id, "create_app_api_key", "failed", `HTTP ${createAppKeyResponse.status}`, undefined, duration, requestId, createAppKeyResponse.status, errorText);
            throw new Error(`Failed to create app API key: ${createAppKeyResponse.status} - ${errorText}`);
          }

          const appKeyData = await createAppKeyResponse.json();
          appApiKey = appKeyData.key;
          appApiKeyId = appKeyData.id;

          const duration = Date.now() - step3Start;
          await logProvisioningStep(supabase, organization_id, "create_app_api_key", "success", "Application API key created", { key_last4: getLast4(appApiKey) }, duration, requestId);
          completedSteps.app_api_key_created = true;

          // Save app API key
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
          // Retrieve existing app API key for webhook creation
          if (ttnConn?.ttn_api_key_encrypted) {
            appApiKey = deobfuscateKey(ttnConn.ttn_api_key_encrypted, encryptionSalt);
          }
          console.log(`[ttn-provision-org] [${requestId}] Step 3: Skipping (app key already created)`);
        }

        // ============ STEP 3B: Create Gateway API Key (optional, using ORG key) ============
        const step3bStart = Date.now();
        if (!completedSteps.gateway_key_attempted) {
          await logProvisioningStep(supabase, organization_id, "create_gateway_key", "started", "Creating gateway API key (optional)", undefined, undefined, requestId);

          console.log(`[ttn-provision-org] [${requestId}] Step 3B: Creating gateway API key for org ${ttnOrgId}`);

          try {
            // For gateway provisioning, we create an org-level key with gateway rights
            // This allows creating gateways under the organization
            const createGatewayKeyResponse = await fetchWithTimeout(
              `${IDENTITY_SERVER_URL}/api/v3/organizations/${ttnOrgId}/api-keys`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${orgApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: `FreshTracker Gateway Key - ${org.slug}`,
                  rights: GATEWAY_KEY_RIGHTS,
                }),
              }
            );

            if (createGatewayKeyResponse.ok) {
              const gatewayKeyData = await createGatewayKeyResponse.json();
              const gatewayApiKey = gatewayKeyData.key;
              const gatewayApiKeyId = gatewayKeyData.id;

              const duration = Date.now() - step3bStart;
              await logProvisioningStep(supabase, organization_id, "create_gateway_key", "success", "Gateway API key created", { key_last4: getLast4(gatewayApiKey) }, duration, requestId);
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
              const duration = Date.now() - step3bStart;
              await logProvisioningStep(supabase, organization_id, "create_gateway_key", "skipped", `Gateway key creation failed (non-blocking): ${errorText}`, undefined, duration, requestId, createGatewayKeyResponse.status);
              console.warn(`[ttn-provision-org] [${requestId}] Warning: Gateway key creation failed - gateway provisioning will not be available`);
            }
          } catch (gatewayErr) {
            const duration = Date.now() - step3bStart;
            const errMsg = gatewayErr instanceof Error ? gatewayErr.message : "Unknown error";
            await logProvisioningStep(supabase, organization_id, "create_gateway_key", "skipped", `Gateway key creation failed (non-blocking): ${errMsg}`, undefined, duration, requestId);
          }

          completedSteps.gateway_key_attempted = true;
          await supabase
            .from("ttn_connections")
            .update({ provisioning_step_details: completedSteps })
            .eq("organization_id", organization_id);
        }

        // Ensure we have app API key for webhook creation
        if (!appApiKey) {
          throw new Error("App API key not available - cannot proceed with webhook creation");
        }

        // ============ STEP 4: Create Webhook (using APP API KEY - CRITICAL!) ============
        const step4Start = Date.now();
        let webhookCreated = false;

        if (!completedSteps.webhook_created) {
          await logProvisioningStep(supabase, organization_id, "create_webhook", "started", "Creating TTN webhook", { webhook_url: webhookUrl }, undefined, requestId);
          await updateProvisioningState(supabase, organization_id, { step: "create_webhook" });

          console.log(`[ttn-provision-org] [${requestId}] Step 4: Creating webhook for ${ttnAppId} (using APP API KEY)`);

          webhookSecret = generateWebhookSecret();

          // Try POST first, then PUT if exists
          const createWebhookResponse = await fetchWithTimeout(`${regionalUrl}/api/v3/as/webhooks/${ttnAppId}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${appApiKey}`,
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
          });

          if (createWebhookResponse.ok) {
            webhookCreated = true;
          } else if (createWebhookResponse.status === 409) {
            // Webhook exists, try PUT to update
            console.log(`[ttn-provision-org] [${requestId}] Webhook exists, updating...`);
            const updateResponse = await fetchWithTimeout(
              `${regionalUrl}/api/v3/as/webhooks/${ttnAppId}/freshtracker`,
              {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${appApiKey}`,
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
            webhookCreated = updateResponse.ok;
            if (!webhookCreated) {
              const updateError = await updateResponse.text();
              console.warn(`[ttn-provision-org] [${requestId}] Webhook update failed: ${updateError}`);
            }
          } else {
            const errorText = await createWebhookResponse.text();
            console.error(`[ttn-provision-org] [${requestId}] Webhook creation failed: ${errorText}`);
          }

          const duration = Date.now() - step4Start;
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
            await logProvisioningStep(supabase, organization_id, "create_webhook", "failed", "Webhook creation failed", undefined, duration, requestId);
            // Don't fail the whole provisioning - webhook can be created manually
            console.warn(`[ttn-provision-org] [${requestId}] Webhook creation failed - will need manual setup`);
          }
        } else {
          webhookCreated = true;
        }

        // ============ STEP 5: Finalize ============
        console.log(`[ttn-provision-org] [${requestId}] Step 5: Finalizing provisioning`);

        await updateProvisioningState(supabase, organization_id, {
          status: "ready",
          step: "complete",
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
            ttn_organization_id: ttnOrgId,
            ttn_application_id: ttnAppId,
            region,
            webhook_url: webhookUrl,
            webhook_created: webhookCreated,
            request_id: requestId,
          },
        });

        await logProvisioningStep(supabase, organization_id, "complete", "success", "Provisioning completed", {
          ttn_org_id: ttnOrgId,
          ttn_app_id: ttnAppId,
          webhook_created: webhookCreated,
        }, undefined, requestId);

        console.log(`[ttn-provision-org] [${requestId}] Provisioning complete for org ${ttnOrgId}, app ${ttnAppId}`);

        return new Response(
          JSON.stringify({
            success: true,
            ttn_organization_id: ttnOrgId,
            ttn_application_id: ttnAppId,
            provisioning_status: "completed",
            webhook_url: webhookUrl,
            webhook_created: webhookCreated,
            org_api_key_last4: ttnConn?.ttn_org_api_key_last4 || getLast4(orgApiKey),
            app_api_key_last4: ttnConn?.ttn_api_key_last4 || getLast4(appApiKey),
            webhook_secret_last4: webhookSecret ? getLast4(webhookSecret) : null,
            request_id: requestId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (provisionError) {
        const errorMessage = provisionError instanceof Error ? provisionError.message : "Unknown error";
        console.error(`[ttn-provision-org] [${requestId}] Provisioning failed:`, provisionError);

        await supabase
          .from("ttn_connections")
          .update({
            provisioning_status: "failed",
            provisioning_error: errorMessage,
            provisioning_can_retry: true,
            provisioning_step_details: completedSteps,
          })
          .eq("organization_id", organization_id);

        await logProvisioningStep(supabase, organization_id, "error", "failed", errorMessage, { retryable: true }, undefined, requestId);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Provisioning failed",
            message: errorMessage,
            provisioning_status: "failed",
            retryable: true,
            completed_steps: completedSteps,
            request_id: requestId,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========================================
    // ACTION: REGENERATE_WEBHOOK_SECRET
    // ========================================
    if (action === "regenerate_webhook_secret") {
      if (!ttnConn?.ttn_application_id || !ttnConn?.ttn_api_key_encrypted) {
        return new Response(
          JSON.stringify({ error: "TTN application not provisioned yet", request_id: requestId }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const appApiKey = deobfuscateKey(ttnConn.ttn_api_key_encrypted, encryptionSalt);
      const newSecret = generateWebhookSecret();
      const regionalUrl = REGIONAL_URLS[region] || REGIONAL_URLS.nam1;
      const webhookUrl = supabaseUrl.startsWith("http")
        ? `${supabaseUrl}/functions/v1/ttn-webhook`
        : `https://${supabaseUrl}/functions/v1/ttn-webhook`;

      try {
        const updateWebhookResponse = await fetchWithTimeout(
          `${regionalUrl}/api/v3/as/webhooks/${ttnConn.ttn_application_id}/freshtracker`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${appApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              webhook: {
                ids: {
                  webhook_id: "freshtracker",
                  application_ids: { application_id: ttnConn.ttn_application_id },
                },
                base_url: webhookUrl,
                headers: { "X-Webhook-Secret": newSecret },
              },
              field_mask: {
                paths: ["headers", "base_url"],
              },
            }),
          }
        );

        if (!updateWebhookResponse.ok) {
          const errorText = await updateWebhookResponse.text();
          return new Response(
            JSON.stringify({ success: false, error: "Failed to update webhook in TTN", details: errorText, request_id: requestId }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const encryptedSecret = obfuscateKey(newSecret, encryptionSalt);
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
        return new Response(
          JSON.stringify({ success: false, error: errorMessage, request_id: requestId }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========================================
    // ACTION: DELETE
    // ========================================
    if (action === "delete") {
      if (!ttnConn?.ttn_organization_id && !ttnConn?.ttn_application_id) {
        return new Response(
          JSON.stringify({ success: true, message: "No TTN resources to delete", request_id: requestId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        await logProvisioningStep(supabase, organization_id, "delete", "started", "Deleting TTN resources", undefined, undefined, requestId);

        // Delete organization (this cascades to delete applications)
        if (ttnConn.ttn_organization_id) {
          const deleteOrgResponse = await fetchWithTimeout(
            `${IDENTITY_SERVER_URL}/api/v3/organizations/${ttnConn.ttn_organization_id}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${ttnAdminKey}` },
            }
          );

          if (!deleteOrgResponse.ok && deleteOrgResponse.status !== 404) {
            const errorText = await deleteOrgResponse.text();
            throw new Error(`Failed to delete organization: ${deleteOrgResponse.status} - ${errorText}`);
          }
        }

        // Clear TTN settings
        await supabase
          .from("ttn_connections")
          .update({
            ttn_organization_id: null,
            ttn_org_api_key_encrypted: null,
            ttn_org_api_key_last4: null,
            ttn_org_api_key_id: null,
            ttn_application_id: null,
            ttn_application_name: null,
            ttn_api_key_encrypted: null,
            ttn_api_key_last4: null,
            ttn_api_key_id: null,
            ttn_gateway_api_key_encrypted: null,
            ttn_gateway_api_key_last4: null,
            ttn_gateway_api_key_id: null,
            ttn_webhook_secret_encrypted: null,
            ttn_webhook_secret_last4: null,
            ttn_webhook_url: null,
            provisioning_status: "idle",
            provisioning_error: null,
            provisioning_step: null,
            provisioning_step_details: null,
            ttn_application_provisioned_at: null,
            ttn_organization_provisioned_at: null,
            is_enabled: false,
            updated_by: user.id,
          })
          .eq("organization_id", organization_id);

        await logProvisioningStep(supabase, organization_id, "delete", "success", "TTN resources deleted", undefined, undefined, requestId);

        return new Response(
          JSON.stringify({ success: true, message: "TTN resources deleted", request_id: requestId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (deleteError) {
        const errorMessage = deleteError instanceof Error ? deleteError.message : "Unknown error";
        await logProvisioningStep(supabase, organization_id, "delete", "failed", errorMessage, undefined, undefined, requestId);

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
