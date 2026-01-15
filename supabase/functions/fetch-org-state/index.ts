/**
 * Fetch Org State Edge Function
 *
 * Provides read-only access to organization TTN configuration for the Emulator.
 * Returns canonical TTN settings including webhook metadata.
 *
 * Security:
 * - Requires PROJECT2_SYNC_API_KEY for authentication
 * - Read-only - does not modify any data
 *
 * Used by:
 * - Emulator to sync TTN configuration from FrostGuard
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-api-key",
};

// Validate PROJECT2_SYNC_API_KEY
function validateSyncApiKey(req: Request): { valid: boolean; error?: string } {
  const expectedKey = Deno.env.get("PROJECT2_SYNC_API_KEY");
  if (!expectedKey) {
    return { valid: false, error: "PROJECT2_SYNC_API_KEY not configured" };
  }

  // Check Authorization header first
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token === expectedKey) {
      return { valid: true };
    }
  }

  // Check X-Sync-API-Key header
  const syncKeyHeader = req.headers.get("x-sync-api-key");
  if (syncKeyHeader === expectedKey) {
    return { valid: true };
  }

  return { valid: false, error: "Invalid or missing API key" };
}

serve(async (req) => {
  const BUILD_VERSION = "fetch-org-state-v1.0-20260102";
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[fetch-org-state] [${requestId}] Build: ${BUILD_VERSION}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET" && !req.headers.get("x-sync-api-key") && !req.headers.get("authorization")) {
    return new Response(
      JSON.stringify({
        status: "ok",
        function: "fetch-org-state",
        version: BUILD_VERSION,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate API key
  const authResult = validateSyncApiKey(req);
  if (!authResult.valid) {
    console.warn(`[fetch-org-state] [${requestId}] Auth failed: ${authResult.error}`);
    return new Response(
      JSON.stringify({
        ok: false,
        error_code: "UNAUTHORIZED",
        message: authResult.error || "Unauthorized",
        request_id: requestId,
      }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse request - support both GET with query params and POST with body
    let orgId: string | undefined;

    if (req.method === "POST") {
      const body = await req.json();
      orgId = body.org_id;
    } else {
      const url = new URL(req.url);
      orgId = url.searchParams.get("org_id") || undefined;
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error_code: "MISSING_ORG_ID",
          message: "org_id is required",
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fetch-org-state] [${requestId}] Fetching state for org: ${orgId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error_code: "CONFIG_ERROR",
          message: "Server configuration error",
          request_id: requestId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, slug, deleted_at")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({
          ok: false,
          error_code: "ORG_NOT_FOUND",
          message: "Organization not found",
          request_id: requestId,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch TTN settings
    const { data: ttnSettings, error: ttnError } = await supabase
      .from("ttn_connections")
      .select(`
        is_enabled,
        ttn_region,
        ttn_application_id,
        ttn_api_key_last4,
        ttn_api_key_updated_at,
        ttn_webhook_secret_last4,
        ttn_webhook_url,
        ttn_webhook_id,
        ttn_webhook_events,
        ttn_last_updated_source,
        provisioning_status,
        updated_at
      `)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (ttnError) {
      console.error(`[fetch-org-state] [${requestId}] Error fetching TTN settings:`, ttnError);
    }

    // Build response
    const response = {
      ok: true,
      request_id: requestId,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
      ttn: ttnSettings ? {
        enabled: ttnSettings.is_enabled ?? false,
        cluster: ttnSettings.ttn_region,
        application_id: ttnSettings.ttn_application_id,
        api_key_last4: ttnSettings.ttn_api_key_last4,
        api_key_updated_at: ttnSettings.ttn_api_key_updated_at,
        webhook_secret_last4: ttnSettings.ttn_webhook_secret_last4,
        webhook_url: ttnSettings.ttn_webhook_url,
        webhook_id: ttnSettings.ttn_webhook_id || "freshtracker",
        webhook_events: ttnSettings.ttn_webhook_events || ["uplink_message", "join_accept"],
        provisioning_status: ttnSettings.provisioning_status || "not_started",
        updated_at: ttnSettings.updated_at,
        last_updated_source: ttnSettings.ttn_last_updated_source,
        // Explicit flag for emulator UI
        synced_from_frostguard: ttnSettings.ttn_last_updated_source === "frostguard",
      } : {
        enabled: false,
        cluster: null,
        application_id: null,
        api_key_last4: null,
        webhook_secret_last4: null,
        webhook_url: null,
        webhook_id: null,
        webhook_events: null,
        provisioning_status: "not_started",
        updated_at: null,
        last_updated_source: null,
        synced_from_frostguard: false,
      },
      _meta: {
        version: BUILD_VERSION,
        timestamp: new Date().toISOString(),
      },
    };

    console.log(`[fetch-org-state] [${requestId}] Success - TTN enabled: ${response.ttn.enabled}`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[fetch-org-state] [${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({
        ok: false,
        error_code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Internal error",
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
