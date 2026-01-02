import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Simple XOR obfuscation for API keys (matching existing pattern)
function obfuscateKey(key: string, salt: string): string {
  const combined = key + salt;
  const bytes = new TextEncoder().encode(combined);
  const obfuscated = bytes.map((byte, i) => byte ^ ((i * 31 + 17) % 256));
  return btoa(String.fromCharCode(...obfuscated));
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

  log("info", "TTN_SETTINGS_SYNC_PROCESSING", {
    request_id: requestId,
    org_id: body.org_id,
    has_api_key: !!body.api_key,
    has_webhook_secret: !!body.webhook_secret,
    enabled: body.enabled,
    cluster: body.cluster,
    application_id: body.application_id,
  });

  // Initialize Supabase client with service role
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    log("error", "TTN_SETTINGS_SYNC_CONFIG_ERROR", { request_id: requestId });
    return errorResponse(500, "CONFIG_ERROR", "Server configuration error", "Contact administrator", requestId);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const salt = org.slug || org.id;
    const updateData: Record<string, unknown> = {
      organization_id: body.org_id,
      updated_at: new Date().toISOString(),
    };

    // Handle enabled flag
    if (body.enabled !== undefined) {
      updateData.is_enabled = body.enabled;
    }

    // Handle cluster/region
    if (body.cluster !== undefined) {
      updateData.ttn_region = body.cluster;
    }

    // Handle application_id
    if (body.application_id !== undefined) {
      updateData.ttn_application_id = body.application_id;
    }

    // Handle API key encryption
    let apiKeyLast4: string | null = null;
    if (body.api_key) {
      updateData.ttn_api_key_encrypted = obfuscateKey(body.api_key, salt);
      apiKeyLast4 = body.api_key.slice(-4);
      updateData.ttn_api_key_last4 = apiKeyLast4;
      // Clear old test results since key changed
      updateData.last_connection_test_result = null;
      updateData.last_connection_test_at = null;
    }

    // Handle webhook secret encryption
    let webhookSecretLast4: string | null = null;
    if (body.webhook_secret) {
      updateData.ttn_webhook_secret_encrypted = obfuscateKey(body.webhook_secret, salt);
      webhookSecretLast4 = body.webhook_secret.slice(-4);
      updateData.ttn_webhook_secret_last4 = webhookSecretLast4;
    }

    // Upsert into ttn_connections
    const { data: ttnConn, error: upsertError } = await supabase
      .from("ttn_connections")
      .upsert(updateData, { onConflict: "organization_id" })
      .select("is_enabled, ttn_region, ttn_application_id, ttn_api_key_last4, ttn_webhook_secret_last4, updated_at")
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

    const duration = Date.now() - startTime;
    log("info", "TTN_SETTINGS_UPSERT_OK", {
      request_id: requestId,
      org_id: body.org_id,
      api_key_last4: ttnConn?.ttn_api_key_last4 || apiKeyLast4,
      enabled: ttnConn?.is_enabled,
      duration_ms: duration,
    });

    // Return success response
    return new Response(
      JSON.stringify({
        ok: true,
        request_id: requestId,
        ttn: {
          enabled: ttnConn?.is_enabled ?? false,
          cluster: ttnConn?.ttn_region,
          application_id: ttnConn?.ttn_application_id,
          api_key_last4: ttnConn?.ttn_api_key_last4,
          webhook_secret_last4: ttnConn?.ttn_webhook_secret_last4,
          updated_at: ttnConn?.updated_at,
        },
        _meta: {
          duration_ms: duration,
          version: "1.0.0",
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
