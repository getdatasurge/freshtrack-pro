import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUILD_VERSION = "get-ttn-integration-snapshot-v1.1-20251231";

// CORS headers - allow all origins and Project 2's x-sync-shared-secret header
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-emulator-sync-key, x-integration-snapshot-key, x-sync-shared-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET, HEAD",
};

function generateRequestId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

serve(async (req) => {
  const requestId = generateRequestId();
  
  console.log(`[${requestId}] ${req.method} request, version: ${BUILD_VERSION}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, version: BUILD_VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Validate shared secret authentication
    const authResult = validateSharedSecret(req);
    if (!authResult.valid) {
      console.error(`[${requestId}] Auth failed: ${authResult.error}`);
      return new Response(
        JSON.stringify({ ok: false, error: authResult.error, code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    // Support both naming conventions from Project 2
    const user_id = body.user_id;
    const organization_id = body.organization_id || body.org_id;
    const site_id = body.site_id;

    console.log(`[${requestId}] Snapshot request - user_id: ${user_id}, org_id: ${organization_id}, site_id: ${site_id}`);

    if (!user_id && !organization_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "user_id or organization_id is required", code: "MISSING_PARAM" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] Missing Supabase configuration`);
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error", code: "CONFIG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve organization_id from user_id if needed
    let resolvedOrgId = organization_id;
    
    if (user_id && !organization_id) {
      console.log(`[${requestId}] Resolving org from user_id: ${user_id}`);
      
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user_id)
        .single();

      if (profileError || !profile?.organization_id) {
        console.error(`[${requestId}] User not found or has no organization: ${profileError?.message}`);
        return new Response(
          JSON.stringify({ ok: false, error: "User profile or organization not found", code: "NOT_FOUND" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      resolvedOrgId = profile.organization_id;
      console.log(`[${requestId}] Resolved org_id: ${resolvedOrgId}`);
    }

    // Fetch TTN integration from ttn_connections table
    const { data: ttnConnection, error: ttnError } = await supabaseAdmin
      .from("ttn_connections")
      .select(`
        id,
        organization_id,
        ttn_region,
        ttn_application_id,
        ttn_api_key_id,
        ttn_api_key_last4,
        ttn_webhook_id,
        ttn_webhook_url,
        is_enabled,
        provisioning_status,
        last_connection_test_at,
        last_connection_test_result,
        updated_at
      `)
      .eq("organization_id", resolvedOrgId)
      .single();

    if (ttnError) {
      if (ttnError.code === "PGRST116") {
        // No rows returned - match Project 2's expected format
        console.log(`[${requestId}] No TTN integration found for org: ${resolvedOrgId}`);
        return new Response(
          JSON.stringify({ ok: false, error: "No TTN integration configured for this organization", code: "NOT_FOUND" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.error(`[${requestId}] Database error: ${ttnError.message}`);
      return new Response(
        JSON.stringify({ ok: false, error: "Database error", code: "INTERNAL_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract test result from JSON column
    const testResult = ttnConnection.last_connection_test_result as Record<string, unknown> | null;

    // Build snapshot in Project 2's expected TTNSnapshot format
    const snapshot = {
      cluster: ttnConnection.ttn_region || "nam1",
      application_id: ttnConnection.ttn_application_id || "",
      api_key_last4: ttnConnection.ttn_api_key_last4 || "****",
      api_key_id: ttnConnection.ttn_api_key_id || undefined,
      ttn_enabled: ttnConnection.is_enabled ?? true,
      webhook_id: ttnConnection.ttn_webhook_id || undefined,
      webhook_enabled: !!ttnConnection.ttn_webhook_id,
      webhook_base_url: ttnConnection.ttn_webhook_url || undefined,
      updated_at: ttnConnection.updated_at || new Date().toISOString(),
      last_test_at: ttnConnection.last_connection_test_at || undefined,
      last_test_success: testResult?.success as boolean | undefined,
      last_test_message: (testResult?.message as string) || undefined,
    };

    console.log(`[${requestId}] Returning snapshot for org: ${resolvedOrgId}, app_id: ${ttnConnection.ttn_application_id}`);

    // Return snapshot directly (not wrapped) to match Project 2's expected format
    return new Response(
      JSON.stringify(snapshot),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(`[${requestId}] Unexpected error:`, err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Internal server error", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Validate shared secret for service-to-service authentication.
 * Supports multiple header names for compatibility with Project 2.
 */
function validateSharedSecret(req: Request): { valid: boolean; error?: string } {
  const expectedKey = Deno.env.get("EMULATOR_SYNC_API_KEY");
  
  if (!expectedKey) {
    return { valid: false, error: "Server not configured for integration access" };
  }

  // Check multiple header options - including x-sync-shared-secret from Project 2
  const providedKey = 
    req.headers.get("x-sync-shared-secret") ||
    req.headers.get("x-integration-snapshot-key") ||
    req.headers.get("x-emulator-sync-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!providedKey) {
    return { valid: false, error: "Missing authentication header" };
  }

  if (providedKey !== expectedKey) {
    return { valid: false, error: "Invalid authentication key" };
  }

  return { valid: true };
}
