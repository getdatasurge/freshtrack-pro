import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTtnConfigForOrg, getGatewayApiKeyForOrg } from "../_shared/ttnConfig.ts";
import { validateGatewayPermissions } from "../_shared/ttnPermissions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface ProvisionRequest {
  action: "create" | "delete";
  gateway_id: string;
  organization_id: string;
}

interface AuthInfo {
  is_admin?: boolean;
  universal_rights?: string[];
  user_ids?: Array<{ user_id: string }>;
  organization_ids?: Array<{ organization_id: string }>;
  application_ids?: Array<{ application_id: string }>;
}

interface RegistrationResult {
  success: boolean;
  ttn_gateway_id?: string;
  already_exists?: boolean;
  error?: string;
  error_code?: string;
  hint?: string;
  details?: string;
}

serve(async (req) => {
  const BUILD_VERSION = "ttn-provision-gateway-v2-multi-strategy-20250102";
  const requestId = crypto.randomUUID().slice(0, 8);
  
  console.log(`[ttn-provision-gateway] Build: ${BUILD_VERSION}`);
  console.log(`[ttn-provision-gateway] [${requestId}] Method: ${req.method}, URL: ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Health check / diagnostics endpoint
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        status: "healthy",
        function: "ttn-provision-gateway",
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
      console.error(`[ttn-provision-gateway] [${requestId}] Missing Supabase credentials`);
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
    let body: ProvisionRequest;
    try {
      const bodyText = await req.text();
      console.log(`[ttn-provision-gateway] [${requestId}] Raw request body:`, bodyText);

      if (!bodyText || bodyText.trim() === "") {
        return new Response(
          JSON.stringify({ ok: false, error: "Empty request body", request_id: requestId }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      body = JSON.parse(bodyText);
      console.log(`[ttn-provision-gateway] [${requestId}] Parsed payload:`, JSON.stringify(body));
    } catch (parseError) {
      console.error(`[ttn-provision-gateway] [${requestId}] JSON parse error:`, parseError);
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

    const { action, gateway_id, organization_id } = body;
    console.log(`[ttn-provision-gateway] [${requestId}] Action: ${action}, Gateway: ${gateway_id}, Org: ${organization_id}`);

    // Get TTN config for this org
    const ttnConfig = await getTtnConfigForOrg(supabase, organization_id, { requireEnabled: true });

    if (!ttnConfig) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "TTN not configured for this organization",
          error_code: "TTN_NOT_CONFIGURED",
          hint: "Configure TTN connection in Settings → Developer first",
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // GATEWAY API KEY RESOLUTION
    // Priority: 1) Gateway-specific key, 2) Admin key, 3) Application key (will fail)
    // ========================================

    // Try to get gateway-specific API key first (Personal or Organization key)
    const gatewayKeyConfig = await getGatewayApiKeyForOrg(supabase, organization_id);
    const adminApiKey = Deno.env.get("TTN_ADMIN_API_KEY");
    const adminUserId = Deno.env.get("TTN_USER_ID");

    let gatewayApiKey: string | null = null;
    let gatewayKeyType: "gateway" | "admin" | "application" = "application";
    let gatewayKeyScopeId: string | null = null;

    if (gatewayKeyConfig?.apiKey) {
      // Validate the gateway key has proper permissions
      const permCheck = await validateGatewayPermissions(ttnConfig.region, gatewayKeyConfig.apiKey, requestId);
      if (permCheck.success && permCheck.report?.can_provision_gateways) {
        gatewayApiKey = gatewayKeyConfig.apiKey;
        gatewayKeyType = "gateway";
        gatewayKeyScopeId = gatewayKeyConfig.scopeId;
        console.log(`[ttn-provision-gateway] [${requestId}] Using gateway-specific API key (${gatewayKeyConfig.keyType})`);
      } else {
        console.warn(`[ttn-provision-gateway] [${requestId}] Gateway key exists but lacks permissions:`, permCheck.report?.missing_rights);
      }
    }

    // Fallback to admin key if available
    if (!gatewayApiKey && adminApiKey && adminUserId) {
      gatewayApiKey = adminApiKey;
      gatewayKeyType = "admin";
      gatewayKeyScopeId = adminUserId;
      console.log(`[ttn-provision-gateway] [${requestId}] Using admin API key for gateway provisioning`);
    }

    // Last resort: application key (will likely fail for gateway provisioning)
    if (!gatewayApiKey && ttnConfig.apiKey) {
      gatewayApiKey = ttnConfig.apiKey;
      gatewayKeyType = "application";
      console.warn(`[ttn-provision-gateway] [${requestId}] WARNING: Using application API key - gateway provisioning will likely fail`);
    }

    if (!gatewayApiKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No gateway-capable API key configured",
          error_code: "GATEWAY_KEY_MISSING",
          hint: "Gateway provisioning requires a Personal or Organization API key with gateway rights. Application API keys cannot provision gateways.",
          fix_steps: [
            "1. Go to TTN Console → your username (top right) → Personal API keys",
            "2. Click 'Add API key'",
            "3. Name it 'FrostGuard Gateway Provisioning'",
            "4. Grant 'All current and future rights' OR select gateway rights",
            "5. Copy the key and add it in FrostGuard Settings → Developer → Gateway API Key",
          ],
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ttn-provision-gateway] [${requestId}] Gateway key type: ${gatewayKeyType}, scope: ${gatewayKeyScopeId || 'N/A'}`);

    // Keep the application key for application-level operations
    const applicationApiKey = ttnConfig.apiKey;

    // Fetch gateway details
    const { data: gateway, error: gatewayError } = await supabase
      .from("gateways")
      .select("*")
      .eq("id", gateway_id)
      .single();

    if (gatewayError || !gateway) {
      console.error(`[ttn-provision-gateway] [${requestId}] Gateway not found:`, gatewayError);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: "Gateway not found",
          error_code: "GATEWAY_NOT_FOUND",
          request_id: requestId,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate TTN gateway ID from EUI
    const gatewayEui = gateway.gateway_eui.toLowerCase().replace(/[:-]/g, "");
    const ttnGatewayId = `eui-${gatewayEui}`;
    console.log(`[ttn-provision-gateway] [${requestId}] TTN Gateway ID: ${ttnGatewayId}`);

    // Helper for TTN Identity Server API calls
    // Uses gatewayApiKey by default (Personal/Org key with gateway rights)
    const ttnFetch = async (endpoint: string, options: RequestInit = {}, overrideApiKey?: string) => {
      const url = `${ttnConfig.identityBaseUrl}${endpoint}`;
      const key = overrideApiKey || gatewayApiKey;
      console.log(`[ttn-provision-gateway] [${requestId}] TTN API: ${options.method || "GET"} ${url} (key type: ${overrideApiKey ? 'override' : gatewayKeyType})`);
      const response = await fetch(url, {
        ...options,
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      return response;
    };

    if (action === "create") {
      // Step 1: Check if gateway already exists
      console.log(`[ttn-provision-gateway] [${requestId}] Checking if gateway exists`);
      
      const checkResponse = await ttnFetch(`/api/v3/gateways/${ttnGatewayId}`);
      
      if (checkResponse.ok) {
        // Gateway already exists in TTN
        console.log(`[ttn-provision-gateway] [${requestId}] Gateway already exists in TTN`);
        
        // Update our database with TTN info
        await supabase
          .from("gateways")
          .update({
            ttn_gateway_id: ttnGatewayId,
            ttn_registered_at: new Date().toISOString(),
            ttn_last_error: null,
            status: "online",
          })
          .eq("id", gateway_id);

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            gateway_id: ttnGatewayId,
            already_exists: true,
            message: "Gateway already registered in TTN",
            request_id: requestId,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (checkResponse.status !== 404) {
        const errorText = await checkResponse.text();
        console.error(`[ttn-provision-gateway] [${requestId}] Check failed: ${checkResponse.status} - ${errorText}`);
        
        if (checkResponse.status === 403 || checkResponse.status === 401) {
          // API key doesn't have gateway read rights - continue and try to create
          console.log(`[ttn-provision-gateway] [${requestId}] Cannot check gateway existence (${checkResponse.status}), proceeding to create`);
        } else {
          await supabase
            .from("gateways")
            .update({ ttn_last_error: `Check failed: ${checkResponse.status}` })
            .eq("id", gateway_id);
          
          return new Response(
            JSON.stringify({
              ok: false,
              error: `TTN API error (${checkResponse.status})`,
              error_code: "TTN_API_ERROR",
              hint: "Check TTN API key permissions",
              details: errorText.slice(0, 500),
              request_id: requestId,
            }),
            { status: checkResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Step 2: Build gateway payload
      const gatewayPayload = {
        gateway: {
          ids: {
            gateway_id: ttnGatewayId,
            eui: gatewayEui.toUpperCase(),
          },
          name: gateway.name,
          description: gateway.description || `FrostGuard gateway at ${gateway.name}`,
          gateway_server_address: `${ttnConfig.region}.cloud.thethings.network`,
          frequency_plan_ids: [ttnConfig.region === "eu1" ? "EU_863_870_TTN" : "US_902_928_FSB_2"],
          enforce_duty_cycle: true,
          status_public: false,
          location_public: false,
        },
      };

      // Step 3: Determine registration endpoint based on key type
      // Gateway registration endpoint depends on the owner of the API key:
      // - Personal keys: /api/v3/users/{user_id}/gateways
      // - Organization keys: /api/v3/organizations/{org_id}/gateways
      // - Application keys: Cannot register gateways (will fail)

      let registrationEndpoint: string;

      if (gatewayKeyType === "gateway" && gatewayKeyScopeId) {
        // We already know the key type from earlier validation
        // Need to determine if it's user or org scoped by checking auth_info
        const authInfoResponse = await ttnFetch("/api/v3/auth_info");
        if (authInfoResponse.ok) {
          const authInfo: AuthInfo = await authInfoResponse.json();
          if (authInfo.user_ids && authInfo.user_ids.length > 0) {
            registrationEndpoint = `/api/v3/users/${authInfo.user_ids[0].user_id}/gateways`;
            console.log(`[ttn-provision-gateway] [${requestId}] Using user-scoped endpoint: ${registrationEndpoint}`);
          } else if (authInfo.organization_ids && authInfo.organization_ids.length > 0) {
            registrationEndpoint = `/api/v3/organizations/${authInfo.organization_ids[0].organization_id}/gateways`;
            console.log(`[ttn-provision-gateway] [${requestId}] Using org-scoped endpoint: ${registrationEndpoint}`);
          } else {
            registrationEndpoint = "/api/v3/gateways"; // Fallback
          }
        } else {
          registrationEndpoint = "/api/v3/gateways";
        }
      } else if (gatewayKeyType === "admin" && gatewayKeyScopeId) {
        // Admin key is user-scoped
        registrationEndpoint = `/api/v3/users/${gatewayKeyScopeId}/gateways`;
        console.log(`[ttn-provision-gateway] [${requestId}] Using admin user-scoped endpoint: ${registrationEndpoint}`);
      } else {
        // Application key - will likely fail but try direct endpoint
        registrationEndpoint = "/api/v3/gateways";
        console.warn(`[ttn-provision-gateway] [${requestId}] Using direct endpoint (likely to fail with application key)`);
      }

      // Step 4: Register the gateway
      console.log(`[ttn-provision-gateway] [${requestId}] Registering gateway at: ${registrationEndpoint}`);

      const createResponse = await ttnFetch(registrationEndpoint, {
        method: "POST",
        body: JSON.stringify(gatewayPayload),
      });

      if (createResponse.ok) {
        console.log(`[ttn-provision-gateway] [${requestId}] Gateway registered successfully via ${gatewayKeyType} key`);

        // Success! Update database
        await supabase
          .from("gateways")
          .update({
            ttn_gateway_id: ttnGatewayId,
            ttn_registered_at: new Date().toISOString(),
            ttn_last_error: null,
            status: "online",
          })
          .eq("id", gateway_id);

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            gateway_id: ttnGatewayId,
            already_exists: false,
            message: "Gateway registered in TTN successfully",
            key_type_used: gatewayKeyType,
            request_id: requestId,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Registration failed - handle error
      const errorText = await createResponse.text();
      console.error(`[ttn-provision-gateway] [${requestId}] Registration failed: ${createResponse.status} - ${errorText}`);

      // Parse TTN error for better messaging
      let parsedError: Record<string, unknown> = { message: errorText };
      try {
        parsedError = JSON.parse(errorText);
      } catch { /* ignore */ }

      let errorResult: RegistrationResult;

      if (createResponse.status === 409) {
        // Conflict - gateway EUI already registered elsewhere
        errorResult = {
          success: false,
          error: "Gateway EUI already registered",
          error_code: "EUI_CONFLICT",
          hint: "This gateway EUI is registered to another TTN account. Use TTN Console to claim or delete it.",
          details: errorText.slice(0, 300),
        };
      } else if (createResponse.status === 403) {
        // Permission denied
        const ttnErrorName = parsedError.name || "";
        const ttnErrorMessage = parsedError.message || "";

        errorResult = {
          success: false,
          error: "Permission denied",
          error_code: "TTN_PERMISSION_DENIED",
          hint: gatewayKeyType === "application"
            ? "Application API keys cannot provision gateways. You need a Personal API key with gateway rights. Go to TTN Console → your username → Personal API keys."
            : `API key lacks gateway provisioning rights. TTN error: ${ttnErrorName || ttnErrorMessage}`,
          details: errorText.slice(0, 300),
        };
      } else if (createResponse.status === 401) {
        errorResult = {
          success: false,
          error: "Invalid API key",
          error_code: "INVALID_API_KEY",
          hint: "TTN API key is invalid or expired. Generate a new one in TTN Console.",
          details: errorText.slice(0, 300),
        };
      } else {
        // Other error
        errorResult = {
          success: false,
          error: `TTN API error (${createResponse.status})`,
          error_code: "TTN_API_ERROR",
          hint: "Unexpected error from TTN. Check gateway EUI format and try again.",
          details: errorText.slice(0, 300),
        };
      }

      console.error(`[ttn-provision-gateway] [${requestId}] Gateway registration failed:`, errorResult);

      await supabase
        .from("gateways")
        .update({
          ttn_last_error: `${errorResult.error}: ${errorResult.hint || ''}`.slice(0, 500),
        })
        .eq("id", gateway_id);

      return new Response(
        JSON.stringify({
          ok: false,
          ...errorResult,
          key_type_used: gatewayKeyType,
          request_id: requestId,
        }),
        { status: createResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      console.log(`[ttn-provision-gateway] [${requestId}] Deleting gateway ${ttnGatewayId} from TTN`);

      const deleteResponse = await ttnFetch(`/api/v3/gateways/${ttnGatewayId}`, {
        method: "DELETE",
      });

      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        const errorText = await deleteResponse.text();
        console.error(`[ttn-provision-gateway] [${requestId}] Delete failed: ${errorText}`);
        return new Response(
          JSON.stringify({ 
            ok: false,
            error: "Failed to delete gateway from TTN", 
            details: errorText,
            request_id: requestId,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Clear TTN fields
      await supabase
        .from("gateways")
        .update({
          ttn_gateway_id: null,
          ttn_registered_at: null,
          ttn_last_error: null,
          status: "pending",
        })
        .eq("id", gateway_id);

      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          message: "Gateway deleted from TTN",
          request_id: requestId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Unknown action", request_id: requestId }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error(`[ttn-provision-gateway] [${requestId}] Error:`, error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: message, 
        error_code: "INTERNAL_ERROR",
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
