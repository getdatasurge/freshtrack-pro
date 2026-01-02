import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { obfuscateKey, getLast4 } from "../_shared/ttnConfig.ts";

/**
 * sync-ttn-settings: Accept TTN settings updates from Emulator (or FrostGuard)
 * using API key authentication only (PROJECT2_SYNC_API_KEY).
 * 
 * This enables bi-directional TTN config sync without JWT or service role keys.
 * Uses shared encryption from _shared/ttnConfig.ts for compatibility.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-api-key",
};

// Generate unique request ID
function generateRequestId(): string {
  return `sync-ttn-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// Structured logging
function log(level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };
  console[level === "error" ? "error" : level === "warn" ? "warn" : "info"](JSON.stringify(entry));
}

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

// Build structured error response
function errorResponse(
  status: number,
  errorCode: string,
  message: string,
  hint: string,
  requestId: string
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error_code: errorCode,
      message,
      hint,
      request_id: requestId,
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

serve(async (req) => {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Only POST requests are allowed", "Use POST method", requestId);
  }

  log("info", "TTN_SETTINGS_SYNC_REQUEST", { request_id: requestId });

  // Validate API key
  const authResult = validateSyncApiKey(req);
  if (!authResult.valid) {
    log("warn", "TTN_SETTINGS_SYNC_AUTH_FAILED", { request_id: requestId, error: authResult.error });
    return errorResponse(401, "UNAUTHORIZED", authResult.error || "Unauthorized", "Provide valid PROJECT2_SYNC_API_KEY", requestId);
  }

  // Parse request body
  let body: {
    org_id?: string;
    enabled?: boolean;
    cluster?: string;
    application_id?: string;
    api_key?: string;
    webhook_secret?: string;
    webhook_url?: string;
    source?: "frostguard" | "emulator";
  };

  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Invalid JSON body", "Provide valid JSON request body", requestId);
  }

  // Validate required fields
  if (!body.org_id) {
    return errorResponse(400, "MISSING_ORG_ID", "org_id is required", "Provide organization UUID", requestId);
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(body.org_id)) {
    return errorResponse(400, "INVALID_ORG_ID", "org_id must be a valid UUID", "Provide valid UUID format", requestId);
  }

  const source = body.source || "emulator";

  log("info", "TTN_SETTINGS_SYNC_PROCESSING", {
    request_id: requestId,
    org_id: body.org_id,
    has_api_key: !!body.api_key,
    has_webhook_secret: !!body.webhook_secret,
    enabled: body.enabled,
    cluster: body.cluster,
    application_id: body.application_id,
    source,
  });

  // Initialize Supabase client with service role
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    log("error", "TTN_SETTINGS_SYNC_CONFIG_ERROR", { request_id: requestId });
    return errorResponse(500, "CONFIG_ERROR", "Server configuration error", "Contact administrator", requestId);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get encryption salt - MUST match _shared/ttnConfig.ts pattern
  const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") || supabaseServiceKey.slice(0, 32);

  try {
    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, slug, deleted_at")
      .eq("id", body.org_id)
      .single();

    if (orgError || !org) {
      log("warn", "TTN_SETTINGS_SYNC_ORG_NOT_FOUND", { request_id: requestId, org_id: body.org_id });
      return errorResponse(404, "ORG_NOT_FOUND", "Organization not found", "Verify organization ID exists", requestId);
    }

    if (org.deleted_at) {
      return errorResponse(400, "ORG_DELETED", "Organization has been deleted", "Cannot update deleted organization", requestId);
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      organization_id: body.org_id,
      updated_at: new Date().toISOString(),
      ttn_last_updated_source: source,
    };

    // Handle enabled flag
    if (body.enabled !== undefined) {
      updateData.is_enabled = body.enabled;
    }

    // Handle cluster/region
    if (body.cluster !== undefined) {
      updateData.ttn_region = body.cluster.toLowerCase();
    }

    // Handle application_id
    if (body.application_id !== undefined) {
      updateData.ttn_application_id = body.application_id;
    }

    // Handle webhook_url
    if (body.webhook_url !== undefined) {
      updateData.ttn_webhook_url = body.webhook_url;
    }

    // Handle API key encryption - use shared obfuscateKey from ttnConfig.ts
    let apiKeyLast4: string | null = null;
    if (body.api_key) {
      updateData.ttn_api_key_encrypted = obfuscateKey(body.api_key, encryptionSalt);
      apiKeyLast4 = getLast4(body.api_key);
      updateData.ttn_api_key_last4 = apiKeyLast4;
      updateData.ttn_api_key_updated_at = new Date().toISOString();
      // Clear old test results since key changed
      updateData.last_connection_test_result = null;
      updateData.last_connection_test_at = null;
      
      log("info", "TTN_SETTINGS_API_KEY_UPDATE", {
        request_id: requestId,
        org_id: body.org_id,
        api_key_last4: apiKeyLast4,
        source,
      });
    }

    // Handle webhook secret encryption
    let webhookSecretLast4: string | null = null;
    if (body.webhook_secret) {
      updateData.ttn_webhook_secret_encrypted = obfuscateKey(body.webhook_secret, encryptionSalt);
      webhookSecretLast4 = getLast4(body.webhook_secret);
      updateData.ttn_webhook_secret_last4 = webhookSecretLast4;
    }

    // Upsert into ttn_connections
    const { data: ttnConn, error: upsertError } = await supabase
      .from("ttn_connections")
      .upsert(updateData, { onConflict: "organization_id" })
      .select("is_enabled, ttn_region, ttn_application_id, ttn_api_key_last4, ttn_api_key_updated_at, ttn_webhook_secret_last4, ttn_webhook_url, ttn_webhook_id, ttn_webhook_events, ttn_last_updated_source, updated_at")
      .single();

    if (upsertError) {
      log("error", "TTN_SETTINGS_UPSERT_ERROR", {
        request_id: requestId,
        org_id: body.org_id,
        error: upsertError.message,
        code: upsertError.code,
      });
      return errorResponse(500, "UPSERT_ERROR", "Failed to update TTN settings", upsertError.message, requestId);
    }

    // Explicitly mark org dirty (trigger should also do this, but be explicit)
    await supabase
      .from("org_sync_state")
      .upsert({
        organization_id: body.org_id,
        is_dirty: true,
        last_change_at: new Date().toISOString(),
        sync_version: 1,
      }, { onConflict: "organization_id" });

    const duration = Date.now() - startTime;
    log("info", "TTN_SETTINGS_UPSERT_OK", {
      request_id: requestId,
      org_id: body.org_id,
      api_key_last4: ttnConn?.ttn_api_key_last4 || apiKeyLast4,
      enabled: ttnConn?.is_enabled,
      source: ttnConn?.ttn_last_updated_source,
      duration_ms: duration,
    });

    // Return success response with source tracking and webhook metadata
    return new Response(
      JSON.stringify({
        ok: true,
        request_id: requestId,
        ttn: {
          enabled: ttnConn?.is_enabled ?? false,
          cluster: ttnConn?.ttn_region,
          application_id: ttnConn?.ttn_application_id,
          webhook_url: ttnConn?.ttn_webhook_url,
          webhook_id: ttnConn?.ttn_webhook_id || "freshtracker",
          webhook_events: ttnConn?.ttn_webhook_events || ["uplink_message", "join_accept"],
          api_key_last4: ttnConn?.ttn_api_key_last4,
          api_key_updated_at: ttnConn?.ttn_api_key_updated_at,
          webhook_secret_last4: ttnConn?.ttn_webhook_secret_last4,
          last_updated_source: ttnConn?.ttn_last_updated_source,
          updated_at: ttnConn?.updated_at,
          // Sync status flag for emulator UI
          synced_from_frostguard: ttnConn?.ttn_last_updated_source === "frostguard",
        },
        _meta: {
          duration_ms: duration,
          version: "2.1.0",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    log("error", "TTN_SETTINGS_SYNC_UNEXPECTED_ERROR", {
      request_id: requestId,
      error: String(error),
    });
    return errorResponse(500, "INTERNAL_ERROR", "Unexpected error", "Check edge function logs", requestId);
  }
});
