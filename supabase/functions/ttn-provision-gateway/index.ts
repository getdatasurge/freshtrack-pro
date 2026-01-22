import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTtnConfigForOrg } from "../_shared/ttnConfig.ts";

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

    if (!ttnConfig.apiKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No TTN API key configured",
          error_code: "API_KEY_MISSING",
          hint: "Add TTN API key in Settings → Developer → TTN Connection",
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // NAM1-ONLY: Use clusterBaseUrl for all TTN operations
    const baseUrl = ttnConfig.clusterBaseUrl;
    
    // Import and use HARD GUARD
    const { assertClusterHost } = await import("../_shared/ttnBase.ts");
    assertClusterHost(`${baseUrl}/api/v3/gateways/${ttnGatewayId}`);

    // Helper for TTN API calls (NAM1-ONLY)
    const ttnFetch = async (endpoint: string, options: RequestInit = {}, apiKey?: string) => {
      const url = `${baseUrl}${endpoint}`;
      const key = apiKey || ttnConfig.apiKey;
      console.log(JSON.stringify({
        event: "ttn_api_call",
        method: options.method || "GET",
        endpoint,
        baseUrl,
        step: "gateway_provision",
        timestamp: new Date().toISOString(),
      }));
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

      // Step 2: Determine API key scope using auth_info
      console.log(`[ttn-provision-gateway] [${requestId}] Checking API key scope via auth_info`);
      
      const authInfoResponse = await ttnFetch("/api/v3/auth_info");
      let authInfo: AuthInfo | null = null;
      
      if (authInfoResponse.ok) {
        authInfo = await authInfoResponse.json();
        console.log(`[ttn-provision-gateway] [${requestId}] Auth info:`, JSON.stringify({
          is_admin: authInfo?.is_admin,
          user_ids: authInfo?.user_ids?.map(u => u.user_id),
          organization_ids: authInfo?.organization_ids?.map(o => o.organization_id),
          application_ids: authInfo?.application_ids?.map(a => a.application_id),
          universal_rights: authInfo?.universal_rights?.slice(0, 5),
        }));
      } else {
        console.warn(`[ttn-provision-gateway] [${requestId}] Could not get auth_info: ${authInfoResponse.status}`);
      }

      // Build gateway payload
      const gatewayPayload = {
        gateway: {
          ids: {
            gateway_id: ttnGatewayId,
            eui: gatewayEui.toUpperCase(),
          },
          name: gateway.name,
          description: gateway.description || `FrostGuard gateway at ${gateway.name}`,
          // NAM1-ONLY: Use NAM1 gateway server address and US frequency plan
          gateway_server_address: "nam1.cloud.thethings.network",
          frequency_plan_ids: ["US_902_928_FSB_2"],
          enforce_duty_cycle: true,
          status_public: false,
          location_public: false,
        },
      };

      // Step 3: Try multiple registration strategies
      // Priority: 1. Gateway-specific key (user-scoped), 2. User-scoped key, 3. Admin fallback
      const strategies: Array<{
        name: string;
        endpoint: string;
        apiKey?: string;
        condition: () => boolean;
      }> = [];

      // Strategy A: Use gateway-specific API key (PREFERRED - has gateway rights)
      // This key is user-scoped and created specifically for gateway provisioning
      if (ttnConfig.hasGatewayKey && ttnConfig.gatewayApiKey) {
        const adminUserId = Deno.env.get("TTN_USER_ID");
        if (adminUserId) {
          strategies.push({
            name: `gateway-key-user-scoped (${adminUserId})`,
            endpoint: `/api/v3/users/${adminUserId}/gateways`,
            apiKey: ttnConfig.gatewayApiKey,
            condition: () => true,
          });
        }
      }

      // Strategy B: User-scoped registration (if main API key is user-scoped)
      if (authInfo?.user_ids && authInfo.user_ids.length > 0) {
        const userId = authInfo.user_ids[0].user_id;
        strategies.push({
          name: `user-scoped (${userId})`,
          endpoint: `/api/v3/users/${userId}/gateways`,
          apiKey: ttnConfig.apiKey,
          condition: () => true,
        });
      }

      // Strategy C: Organization-scoped registration (if API key is org-scoped)
      if (authInfo?.organization_ids && authInfo.organization_ids.length > 0) {
        const ttnOrgId = authInfo.organization_ids[0].organization_id;
        strategies.push({
          name: `org-scoped (${ttnOrgId})`,
          endpoint: `/api/v3/organizations/${ttnOrgId}/gateways`,
          apiKey: ttnConfig.apiKey,
          condition: () => true,
        });
      }

      // Strategy D: Admin key fallback (if available)
      const adminApiKey = Deno.env.get("TTN_ADMIN_API_KEY");
      const adminUserId = Deno.env.get("TTN_USER_ID");
      if (adminApiKey && adminUserId) {
        strategies.push({
          name: `admin-user-scoped (${adminUserId})`,
          endpoint: `/api/v3/users/${adminUserId}/gateways`,
          apiKey: adminApiKey,
          condition: () => true,
        });
      }

      // Strategy E: Direct registration (rarely works but try as last resort)
      strategies.push({
        name: "direct",
        endpoint: "/api/v3/gateways",
        apiKey: ttnConfig.apiKey,
        condition: () => true,
      });

      let lastResult: RegistrationResult = {
        success: false,
        error: "No registration strategy succeeded",
        error_code: "NO_STRATEGY_WORKED",
      };

      for (const strategy of strategies) {
        if (!strategy.condition()) continue;

        console.log(`[ttn-provision-gateway] [${requestId}] Trying strategy: ${strategy.name}`);
        console.log(`[ttn-provision-gateway] [${requestId}] Endpoint: ${strategy.endpoint}`);

        const strategyApiKey = strategy.apiKey || ttnConfig.apiKey;
        const createResponse = await ttnFetch(strategy.endpoint, {
          method: "POST",
          body: JSON.stringify(gatewayPayload),
        }, strategyApiKey);

        if (createResponse.ok) {
          console.log(`[ttn-provision-gateway] [${requestId}] Gateway registered via ${strategy.name}`);
          
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
              strategy: strategy.name,
              request_id: requestId,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check error type
        const errorText = await createResponse.text();
        console.error(`[ttn-provision-gateway] [${requestId}] Strategy ${strategy.name} failed: ${createResponse.status} - ${errorText}`);

        // Parse TTN error for better messaging
        let parsedError = { message: errorText };
        try {
          parsedError = JSON.parse(errorText);
        } catch { /* ignore */ }

        if (createResponse.status === 409) {
          // Conflict - gateway EUI already registered elsewhere
          lastResult = {
            success: false,
            error: "Gateway EUI already registered",
            error_code: "EUI_CONFLICT",
            hint: "This gateway EUI is registered to another TTN account. Use TTN Console to claim or delete it.",
            details: errorText.slice(0, 300),
          };
          break; // No point trying other strategies for 409
        }

        if (createResponse.status === 403) {
          // Permission denied - try next strategy
          const ttnErrorName = (parsedError as Record<string, unknown>).name || "";
          const ttnErrorMessage = (parsedError as Record<string, unknown>).message || "";
          
          lastResult = {
            success: false,
            error: "Permission denied",
            error_code: "TTN_PERMISSION_DENIED",
            hint: `API key lacks gateway provisioning rights. TTN error: ${ttnErrorName || ttnErrorMessage}. Regenerate your TTN API key with 'Write gateway access' permission.`,
            details: errorText.slice(0, 300),
          };
          continue; // Try next strategy
        }

        if (createResponse.status === 401) {
          lastResult = {
            success: false,
            error: "Invalid API key",
            error_code: "INVALID_API_KEY",
            hint: "TTN API key is invalid or expired. Generate a new one in TTN Console.",
            details: errorText.slice(0, 300),
          };
          continue;
        }

        // Other error
        lastResult = {
          success: false,
          error: `TTN API error (${createResponse.status})`,
          error_code: "TTN_API_ERROR",
          hint: "Unexpected error from TTN. Check gateway EUI format and try again.",
          details: errorText.slice(0, 300),
        };
      }

      // All strategies failed
      console.error(`[ttn-provision-gateway] [${requestId}] All strategies failed:`, lastResult);
      
      await supabase
        .from("gateways")
        .update({ 
          ttn_last_error: `${lastResult.error}: ${lastResult.hint || ''}`.slice(0, 500),
        })
        .eq("id", gateway_id);

      return new Response(
        JSON.stringify({
          ok: false,
          ...lastResult,
          request_id: requestId,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
