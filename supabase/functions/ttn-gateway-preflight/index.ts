import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTtnConfigForOrg } from "../_shared/ttnConfig.ts";
import { CLUSTER_BASE_URL, assertClusterHost, logTtnApiCall } from "../_shared/ttnBase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface AuthInfo {
  is_admin?: boolean;
  universal_rights?: string[];
  api_key?: {
    api_key?: {
      rights?: string[];
    };
    entity_ids?: {
      user_ids?: { user_id: string };
      organization_ids?: { organization_id: string };
      application_ids?: { application_id: string };
    };
  };
}

interface PreflightRequest {
  organization_id: string;
}

interface PreflightResult {
  ok: boolean;
  request_id: string;
  allowed: boolean;
  key_type: "personal" | "organization" | "application" | "unknown";
  owner_scope: "user" | "organization" | null;
  scope_id: string | null;
  has_gateway_rights: boolean;
  missing_rights: string[];
  error?: {
    code: "WRONG_KEY_TYPE" | "MISSING_GATEWAY_RIGHTS" | "API_KEY_INVALID" | "TTN_NOT_CONFIGURED";
    message: string;
    hint: string;
    fix_steps: string[];
  };
}

/**
 * Gateway Provisioning Preflight Check
 * 
 * Validates TTN API key type and gateway permissions BEFORE any provisioning attempt.
 * Returns actionable errors with step-by-step fix instructions.
 */

serve(async (req) => {
  const BUILD_VERSION = "ttn-gateway-preflight-v2.0-authinfo-fix-20260105";
  const requestId = crypto.randomUUID().slice(0, 8);

  console.log(`[ttn-gateway-preflight] Build: ${BUILD_VERSION}`);
  console.log(`[ttn-gateway-preflight] [${requestId}] Method: ${req.method}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Health check endpoint
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        status: "healthy",
        function: "ttn-gateway-preflight",
        version: BUILD_VERSION,
        timestamp: new Date().toISOString(),
        request_id: requestId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[ttn-gateway-preflight] [${requestId}] Missing Supabase credentials`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Server configuration error",
          error_code: "CONFIG_MISSING",
          request_id: requestId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let body: PreflightRequest;
    try {
      const bodyText = await req.text();
      if (!bodyText || bodyText.trim() === "") {
        return new Response(
          JSON.stringify({ ok: false, error: "Empty request body", request_id: requestId }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      body = JSON.parse(bodyText);
    } catch (parseError) {
      console.error(`[ttn-gateway-preflight] [${requestId}] JSON parse error:`, parseError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid JSON in request body",
          error_code: "PARSE_ERROR",
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { organization_id } = body;
    console.log(`[ttn-gateway-preflight] [${requestId}] Org: ${organization_id}`);

    // Get TTN config for this org
    const ttnConfig = await getTtnConfigForOrg(supabase, organization_id, { requireEnabled: false });

    if (!ttnConfig) {
      const result: PreflightResult = {
        ok: true,
        request_id: requestId,
        allowed: false,
        key_type: "unknown",
        owner_scope: null,
        scope_id: null,
        has_gateway_rights: false,
        missing_rights: ["gateways:read", "gateways:write"],
        error: {
          code: "TTN_NOT_CONFIGURED",
          message: "TTN is not configured for this organization",
          hint: "Configure TTN connection in Settings → Developer first",
          fix_steps: [
            "1. Go to Settings → Developer → TTN Connection",
            "2. Enter your TTN Application ID and API Key",
            "3. Save the configuration",
          ],
        },
      };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ttnConfig.apiKey) {
      const result: PreflightResult = {
        ok: true,
        request_id: requestId,
        allowed: false,
        key_type: "unknown",
        owner_scope: null,
        scope_id: null,
        has_gateway_rights: false,
        missing_rights: ["gateways:read", "gateways:write"],
        error: {
          code: "API_KEY_INVALID",
          message: "No TTN API key configured",
          hint: "Add a TTN API key in Settings → Developer → TTN Connection",
          fix_steps: [
            "1. Go to TTN Console → Applications → Your App → API Keys",
            "2. Create a new API key with gateway permissions",
            "3. Copy the key and paste it in FrostGuard Settings",
          ],
        },
      };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if we have a dedicated gateway API key (created during provisioning)
    // This takes priority over the main API key for gateway operations
    if (ttnConfig.hasGatewayKey && ttnConfig.gatewayApiKey) {
      console.log(`[ttn-gateway-preflight] [${requestId}] Organization has dedicated gateway API key`);

      // Gateway key is user-scoped and has gateway rights by design
      const result: PreflightResult = {
        ok: true,
        request_id: requestId,
        allowed: true,
        key_type: "personal",
        owner_scope: "user",
        scope_id: Deno.env.get("TTN_USER_ID") || null,
        has_gateway_rights: true,
        missing_rights: [],
      };

      console.log(`[ttn-gateway-preflight] [${requestId}] Preflight passed - using dedicated gateway key`);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check API key scope using auth_info endpoint
    // NAM1-ONLY: Uses CLUSTER_BASE_URL for auth_info (imported from ttnBase.ts)
    const authInfoUrl = `${CLUSTER_BASE_URL}/api/v3/auth_info`;
    assertClusterHost(authInfoUrl);
    console.log(`[ttn-gateway-preflight] [${requestId}] Checking API key scope via auth_info at ${CLUSTER_BASE_URL}`);

    const authInfoResponse = await fetch(authInfoUrl, {
      headers: {
        Authorization: `Bearer ${ttnConfig.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!authInfoResponse.ok) {
      const errorText = await authInfoResponse.text();
      console.error(`[ttn-gateway-preflight] [${requestId}] auth_info failed: ${authInfoResponse.status} ${errorText}`);
      
      // Check for route not found (wrong region/cluster)
      if (authInfoResponse.status === 404 || errorText.includes('route_not_found')) {
        const result: PreflightResult = {
          ok: true,
          request_id: requestId,
          allowed: false,
          key_type: "unknown",
          owner_scope: null,
          scope_id: null,
          has_gateway_rights: false,
          missing_rights: ["gateways:read", "gateways:write"],
          error: {
            code: "TTN_NOT_CONFIGURED" as const,
            message: "TTN region/API base mismatch",
            hint: "Verify TTN cluster setting is configured for NAM1",
            fix_steps: [
              "1. Check your TTN Console URL (should be nam1.cloud.thethings.network)",
              "2. Update TTN cluster in FrostGuard Settings → Developer to NAM1",
              "3. Retry the preflight check",
            ],
          },
        };
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const result: PreflightResult = {
        ok: true,
        request_id: requestId,
        allowed: false,
        key_type: "unknown",
        owner_scope: null,
        scope_id: null,
        has_gateway_rights: false,
        missing_rights: ["gateways:read", "gateways:write"],
        error: {
          code: "API_KEY_INVALID",
          message: "TTN API key is invalid or expired",
          hint: "Generate a new API key in TTN Console",
          fix_steps: [
            "1. Go to TTN Console → your username (top right) → Personal API keys",
            "2. Create a new API key with gateway rights",
            "3. Copy the key and update it in FrostGuard Settings",
          ],
        },
      };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authInfo: AuthInfo = await authInfoResponse.json();
    
    // CRITICAL: TTN auth_info response structure for Personal API keys is DOUBLE-NESTED:
    // { api_key: { api_key: { rights: [...] }, entity_ids: { user_ids: { user_id: "..." } } } }
    const apiKeyWrapper = authInfo.api_key;
    const entityIds = apiKeyWrapper?.entity_ids;
    const innerApiKey = apiKeyWrapper?.api_key;
    
    console.log(`[ttn-gateway-preflight] [${requestId}] Auth info structure:`, JSON.stringify({
      is_admin: authInfo.is_admin,
      has_api_key_wrapper: !!apiKeyWrapper,
      has_inner_api_key: !!innerApiKey,
      entity_ids_keys: entityIds ? Object.keys(entityIds) : [],
      inner_rights_count: innerApiKey?.rights?.length || 0,
      universal_rights_count: authInfo.universal_rights?.length || 0,
    }));

    // Determine key type and scope from entity_ids
    let keyType: "personal" | "organization" | "application" | "unknown" = "unknown";
    let ownerScope: "user" | "organization" | null = null;
    let scopeId: string | null = null;

    if (entityIds?.user_ids?.user_id) {
      keyType = "personal";
      ownerScope = "user";
      scopeId = entityIds.user_ids.user_id;
    } else if (entityIds?.organization_ids?.organization_id) {
      keyType = "organization";
      ownerScope = "organization";
      scopeId = entityIds.organization_ids.organization_id;
    } else if (entityIds?.application_ids?.application_id) {
      keyType = "application";
      ownerScope = null; // Application keys can't provision gateways
      scopeId = entityIds.application_ids.application_id;
    }

    console.log(`[ttn-gateway-preflight] [${requestId}] Key type: ${keyType}, scope: ${ownerScope}, id: ${scopeId}`);

    // Rights: inner.rights → universal_rights fallback
    const rights = innerApiKey?.rights ?? authInfo.universal_rights ?? [];
    const hasGatewayRead = rights.some(
      (r) => r === "RIGHT_GATEWAY_ALL" || r === "RIGHT_GATEWAY_INFO" || r.includes("GATEWAY")
    );
    const hasGatewayWrite = rights.some(
      (r) => r === "RIGHT_GATEWAY_ALL" || r === "RIGHT_GATEWAY_SETTINGS_BASIC" || r === "RIGHT_GATEWAY_SETTINGS_API_KEYS" || r === "RIGHT_USER_GATEWAYS_CREATE"
    );

    const missingRights: string[] = [];
    if (!hasGatewayRead) missingRights.push("gateways:read");
    if (!hasGatewayWrite) missingRights.push("gateways:write");

    console.log(`[ttn-gateway-preflight] [${requestId}] Rights count: ${rights.length}, gateway read: ${hasGatewayRead}, write: ${hasGatewayWrite}`);

    // Update ttn_connections with detected type
    await supabase
      .from("ttn_connections")
      .update({
        ttn_credential_type: keyType === "unknown" ? null : `${keyType}_api_key`,
        ttn_owner_scope: ownerScope,
        ttn_gateway_rights_verified: hasGatewayWrite && hasGatewayRead,
        ttn_gateway_rights_checked_at: new Date().toISOString(),
      })
      .eq("organization_id", organization_id);

    // Determine if provisioning is allowed
    if (keyType === "application") {
      // Application API keys cannot provision gateways
      const result: PreflightResult = {
        ok: true,
        request_id: requestId,
        allowed: false,
        key_type: keyType,
        owner_scope: ownerScope,
        scope_id: scopeId,
        has_gateway_rights: false,
        missing_rights: ["gateways:read", "gateways:write"],
        error: {
          code: "WRONG_KEY_TYPE",
          message: "Application API keys cannot provision gateways",
          hint: "You need a Personal API key (created under your TTN user) to register gateways",
          fix_steps: [
            "1. Go to TTN Console → your username (top right) → Personal API keys",
            "2. Click 'Add API key'",
            "3. Name it 'FrostGuard Gateway Provisioning'",
            "4. Grant rights: 'Grant all current and future rights' OR select gateway rights",
            "5. Copy the key and paste in FrostGuard Settings → Developer → TTN Connection",
          ],
        },
      };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!hasGatewayWrite) {
      // Key type is correct but missing gateway rights
      const result: PreflightResult = {
        ok: true,
        request_id: requestId,
        allowed: false,
        key_type: keyType,
        owner_scope: ownerScope,
        scope_id: scopeId,
        has_gateway_rights: false,
        missing_rights: missingRights,
        error: {
          code: "MISSING_GATEWAY_RIGHTS",
          message: "API key lacks gateway write permission",
          hint: "Regenerate your API key with gateway rights included",
          fix_steps: [
            keyType === "personal"
              ? "1. Go to TTN Console → your username (top right) → Personal API keys"
              : "1. Go to TTN Console → Admin → Organizations → API keys",
            "2. Delete the existing API key (or note its name)",
            "3. Create a new API key with 'Grant all current and future rights' OR specifically select:",
            "   - View gateway information",
            "   - Edit basic gateway settings",
            "4. Copy the new key and update it in FrostGuard Settings",
          ],
        },
      };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All checks passed!
    const result: PreflightResult = {
      ok: true,
      request_id: requestId,
      allowed: true,
      key_type: keyType,
      owner_scope: ownerScope,
      scope_id: scopeId,
      has_gateway_rights: true,
      missing_rights: [],
    };

    console.log(`[ttn-gateway-preflight] [${requestId}] Preflight passed - gateway provisioning allowed`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[ttn-gateway-preflight] [${requestId}] Unhandled error:`, error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Internal server error",
        error_code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : String(error),
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
