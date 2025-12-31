import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUILD_VERSION = "get-ttn-integration-snapshot-v1.0-20251231";

// CORS headers for Project 2 (Emulator) access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Will be restricted to specific origins in production
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-emulator-sync-key, x-integration-snapshot-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://pixel-perfect-emucopy-15.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed.replace(/:\d+$/, '')))) {
    return {
      ...corsHeaders,
      "Access-Control-Allow-Origin": origin,
    };
  }
  return corsHeaders;
}

function generateRequestId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

serve(async (req) => {
  const requestId = generateRequestId();
  const origin = req.headers.get("origin");
  const headers = getCorsHeaders(origin);
  
  console.log(`[${requestId}] ${req.method} request from origin: ${origin}, version: ${BUILD_VERSION}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, version: BUILD_VERSION }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed", request_id: requestId }),
      { status: 405, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  try {
    // Validate shared secret authentication
    const authResult = validateSharedSecret(req);
    if (!authResult.valid) {
      console.error(`[${requestId}] Auth failed: ${authResult.error}`);
      return new Response(
        JSON.stringify({ success: false, error: authResult.error, request_id: requestId }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { user_id, organization_id, site_id } = body;

    console.log(`[${requestId}] Snapshot request - user_id: ${user_id}, org_id: ${organization_id}, site_id: ${site_id}`);

    if (!user_id && !organization_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Either user_id or organization_id is required",
          request_id: requestId 
        }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] Missing Supabase configuration`);
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error", request_id: requestId }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
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
          JSON.stringify({ 
            success: false, 
            error: "User not found or not associated with an organization",
            request_id: requestId 
          }),
          { status: 404, headers: { ...headers, "Content-Type": "application/json" } }
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
        ttn_cluster,
        ttn_application_id,
        api_key_name,
        api_key_id,
        api_key_obfuscated,
        webhook_id,
        webhook_base_url,
        webhook_enabled,
        provisioning_status,
        provisioning_error,
        last_test_at,
        last_test_status,
        last_test_message,
        created_at,
        updated_at
      `)
      .eq("organization_id", resolvedOrgId)
      .single();

    if (ttnError) {
      if (ttnError.code === "PGRST116") {
        // No rows returned
        console.log(`[${requestId}] No TTN integration found for org: ${resolvedOrgId}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            integration: null,
            message: "No TTN integration configured for this organization",
            request_id: requestId 
          }),
          { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
        );
      }
      
      console.error(`[${requestId}] Database error: ${ttnError.message}`);
      return new Response(
        JSON.stringify({ success: false, error: "Database error", request_id: requestId }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Fetch organization details for additional context
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name, slug")
      .eq("id", resolvedOrgId)
      .single();

    // Build sanitized response (never expose full API keys)
    const sanitizedIntegration = {
      organization_id: ttnConnection.organization_id,
      organization_name: org?.name || null,
      organization_slug: org?.slug || null,
      cluster: ttnConnection.ttn_cluster,
      application_id: ttnConnection.ttn_application_id,
      api_key_name: ttnConnection.api_key_name,
      api_key_id: ttnConnection.api_key_id,
      api_key_configured: !!ttnConnection.api_key_obfuscated,
      // Never expose full key - only indicate if it's configured
      webhook_id: ttnConnection.webhook_id,
      webhook_base_url: ttnConnection.webhook_base_url,
      webhook_enabled: ttnConnection.webhook_enabled,
      provisioning_status: ttnConnection.provisioning_status,
      provisioning_error: ttnConnection.provisioning_error,
      last_tested_at: ttnConnection.last_test_at,
      last_test_status: ttnConnection.last_test_status,
      last_test_message: ttnConnection.last_test_message,
      created_at: ttnConnection.created_at,
      updated_at: ttnConnection.updated_at,
    };

    console.log(`[${requestId}] Returning integration snapshot for org: ${resolvedOrgId}, app_id: ${ttnConnection.ttn_application_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        integration: sanitizedIntegration,
        request_id: requestId 
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(`[${requestId}] Unexpected error:`, err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err instanceof Error ? err.message : "Unexpected error",
        request_id: requestId 
      }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Validate shared secret for service-to-service authentication.
 * Reuses EMULATOR_SYNC_API_KEY for cross-project access.
 */
function validateSharedSecret(req: Request): { valid: boolean; error?: string } {
  const expectedKey = Deno.env.get("EMULATOR_SYNC_API_KEY");
  
  if (!expectedKey) {
    return { valid: false, error: "Server not configured for integration access" };
  }

  // Check multiple header options for flexibility
  const providedKey = 
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
