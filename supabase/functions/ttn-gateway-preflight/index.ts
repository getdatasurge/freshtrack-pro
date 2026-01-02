import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTtnConfigForOrg, getGatewayApiKeyForOrg } from "../_shared/ttnConfig.ts";
import { validateGatewayPermissions, checkGatewayRights, type AuthInfoResponse } from "../_shared/ttnPermissions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface AuthInfo {
  is_admin?: boolean;
  universal_rights?: string[];
  user_ids?: Array<{ user_id: string }>;
  organization_ids?: Array<{ organization_id: string }>;
  application_ids?: Array<{ application_id: string }>;
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
  const BUILD_VERSION = "ttn-gateway-preflight-v1-20250102";
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

    // ========================================
    // GATEWAY API KEY CHECK (Priority Order)
    // 1. Check for gateway-specific API key (Personal/Org with gateway rights)
    // 2. Fall back to application API key (will likely fail for gateways)
    // ========================================

    // First, check if there's a dedicated gateway API key configured
    const gatewayKeyConfig = await getGatewayApiKeyForOrg(supabase, organization_id);

    if (gatewayKeyConfig?.apiKey) {
      console.log(`[ttn-gateway-preflight] [${requestId}] Found gateway-specific API key, validating...`);

      const permCheck = await validateGatewayPermissions(ttnConfig.region, gatewayKeyConfig.apiKey, requestId);

      if (permCheck.success && permCheck.report?.can_provision_gateways) {
        // Gateway key is valid and has proper permissions
        const result: PreflightResult = {
          ok: true,
          request_id: requestId,
          allowed: true,
          key_type: permCheck.report.key_type,
          owner_scope: permCheck.report.key_type === "personal" ? "user" : permCheck.report.key_type === "organization" ? "organization" : null,
          scope_id: permCheck.report.scope_id,
          has_gateway_rights: true,
          missing_rights: [],
        };

        console.log(`[ttn-gateway-preflight] [${requestId}] Gateway API key is valid - provisioning allowed`);

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Gateway key exists but has issues
        console.warn(`[ttn-gateway-preflight] [${requestId}] Gateway key has issues:`, permCheck.report?.missing_rights);
      }
    }

    // No valid gateway key - check the application API key
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
          hint: "Gateway provisioning requires a Personal API key with gateway rights",
          fix_steps: [
            "1. Go to TTN Console → your username (top right) → Personal API keys",
            "2. Create a new API key with 'Grant all current and future rights'",
            "3. Copy the key and add it in FrostGuard Settings → Developer → Gateway API Key",
          ],
        },
      };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if application API key has gateway rights (unlikely but possible)
    console.log(`[ttn-gateway-preflight] [${requestId}] Checking application API key for gateway rights`);

    const authInfoResponse = await fetch(`${ttnConfig.identityBaseUrl}/api/v3/auth_info`, {
      headers: {
        Authorization: `Bearer ${ttnConfig.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!authInfoResponse.ok) {
      console.error(`[ttn-gateway-preflight] [${requestId}] auth_info failed: ${authInfoResponse.status}`);

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
          hint: "Generate a new Personal API key in TTN Console with gateway rights",
          fix_steps: [
            "1. Go to TTN Console → your username (top right) → Personal API keys",
            "2. Create a new API key with gateway rights",
            "3. Copy the key and add it in FrostGuard Settings → Developer → Gateway API Key",
          ],
        },
      };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authInfo = await authInfoResponse.json() as AuthInfoResponse;
    console.log(`[ttn-gateway-preflight] [${requestId}] Auth info received:`, JSON.stringify({
      is_admin: authInfo.is_admin,
      user_ids: authInfo.user_ids?.map((u) => u.user_id),
      organization_ids: authInfo.organization_ids?.map((o) => o.organization_id),
      application_ids: authInfo.application_ids?.map((a) => a.application_id),
      universal_rights_count: authInfo.universal_rights?.length || 0,
    }));

    // Use the shared gateway rights checker
    const gatewayRightsReport = checkGatewayRights(authInfo);

    // Determine key type and scope
    let keyType = gatewayRightsReport.key_type;
    let ownerScope: "user" | "organization" | null = null;
    let scopeId = gatewayRightsReport.scope_id;

    if (keyType === "personal") {
      ownerScope = "user";
    } else if (keyType === "organization") {
      ownerScope = "organization";
    } else if (keyType === "application") {
      ownerScope = null; // Application keys can't provision gateways
      scopeId = authInfo.application_ids[0].application_id;
    }

    console.log(`[ttn-gateway-preflight] [${requestId}] Key type: ${keyType}, scope: ${ownerScope}, id: ${scopeId}`);
    console.log(`[ttn-gateway-preflight] [${requestId}] Gateway rights - read: ${gatewayRightsReport.has_gateway_read}, write: ${gatewayRightsReport.has_gateway_write}`);

    // Convert missing rights to user-friendly format
    const missingRights: string[] = [];
    if (!gatewayRightsReport.has_gateway_read) missingRights.push("gateways:read");
    if (!gatewayRightsReport.has_gateway_write) missingRights.push("gateways:write");
    if (!gatewayRightsReport.has_gateway_link) missingRights.push("gateways:link");

    // Update ttn_connections with detected type
    await supabase
      .from("ttn_connections")
      .update({
        ttn_credential_type: keyType === "unknown" ? null : `${keyType}_api_key`,
        ttn_owner_scope: ownerScope,
        ttn_gateway_rights_verified: gatewayRightsReport.can_provision_gateways,
        ttn_gateway_rights_checked_at: new Date().toISOString(),
      })
      .eq("organization_id", organization_id);

    // Determine if provisioning is allowed
    if (keyType === "application") {
      // Application API keys cannot provision gateways - this is a TTN v3 API constraint
      const result: PreflightResult = {
        ok: true,
        request_id: requestId,
        allowed: false,
        key_type: keyType,
        owner_scope: ownerScope,
        scope_id: scopeId,
        has_gateway_rights: false,
        missing_rights: ["gateways:read", "gateways:write", "gateways:link"],
        error: {
          code: "WRONG_KEY_TYPE",
          message: "Application API keys cannot provision gateways",
          hint: "Gateway provisioning requires a Personal or Organization API key. Your current key is application-scoped and can only manage devices within that application.",
          fix_steps: [
            "1. Go to TTN Console → your username (top right) → Personal API keys",
            "2. Click 'Add API key'",
            "3. Name it 'FrostGuard Gateway Provisioning'",
            "4. Grant rights: 'Grant all current and future rights' OR select all gateway rights",
            "5. Copy the key and add it in FrostGuard Settings → Developer → Gateway API Key",
            "",
            "Note: This is a separate key from your application API key. You need both:",
            "• Application API Key: for managing devices and webhooks",
            "• Gateway API Key: for provisioning gateways",
          ],
        },
      };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!gatewayRightsReport.can_provision_gateways) {
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
