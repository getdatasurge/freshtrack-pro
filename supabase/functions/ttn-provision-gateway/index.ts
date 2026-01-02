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

serve(async (req) => {
  const BUILD_VERSION = "ttn-provision-gateway-v1-20250102";
  console.log(`[ttn-provision-gateway] Build: ${BUILD_VERSION}`);
  console.log(`[ttn-provision-gateway] Method: ${req.method}, URL: ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Health check / diagnostics endpoint
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "ok",
        function: "ttn-provision-gateway",
        version: BUILD_VERSION,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[ttn-provision-gateway] Missing Supabase credentials");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error",
          error_code: "CONFIG_MISSING",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let body: ProvisionRequest;
    try {
      const bodyText = await req.text();
      console.log("[ttn-provision-gateway] Raw request body:", bodyText);

      if (!bodyText || bodyText.trim() === "") {
        return new Response(
          JSON.stringify({ success: false, error: "Empty request body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      body = JSON.parse(bodyText);
      console.log("[ttn-provision-gateway] Parsed payload:", JSON.stringify(body));
    } catch (parseError) {
      console.error("[ttn-provision-gateway] JSON parse error:", parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
          error_code: "PARSE_ERROR",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, gateway_id, organization_id } = body;
    const requestId = crypto.randomUUID().slice(0, 8);
    console.log(`[ttn-provision-gateway] [${requestId}] Action: ${action}, Gateway: ${gateway_id}, Org: ${organization_id}`);

    // Get TTN config for this org
    const ttnConfig = await getTtnConfigForOrg(supabase, organization_id, { requireEnabled: true });

    if (!ttnConfig) {
      return new Response(
        JSON.stringify({
          success: false,
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
          success: false,
          error: "No TTN API key configured",
          error_code: "API_KEY_MISSING",
          hint: "Add TTN API key in Settings → Developer → TTN Connection",
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate TTN_USER_ID is set (required for user-scoped gateway creation)
    const ttnUserId = Deno.env.get("TTN_USER_ID");
    if (!ttnUserId) {
      console.error(`[ttn-provision-gateway] [${requestId}] Missing TTN_USER_ID environment variable`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "TTN user ID not configured",
          error_code: "CONFIG_MISSING",
          hint: "Set TTN_USER_ID in Supabase secrets",
          request_id: requestId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log(`[ttn-provision-gateway] [${requestId}] TTN User ID: ${ttnUserId}`);

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
          success: false, 
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
    const ttnFetch = async (endpoint: string, options: RequestInit = {}) => {
      const url = `${ttnConfig.identityBaseUrl}${endpoint}`;
      console.log(`[ttn-provision-gateway] [${requestId}] TTN API: ${options.method || "GET"} ${url}`);
      const response = await fetch(url, {
        ...options,
        headers: {
          "Authorization": `Bearer ${ttnConfig.apiKey}`,
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
            success: true,
            gateway_id: ttnGatewayId,
            already_exists: true,
            message: "Gateway already registered in TTN",
            request_id: requestId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (checkResponse.status !== 404) {
        // Some other error
        const errorText = await checkResponse.text();
        console.error(`[ttn-provision-gateway] [${requestId}] Check failed: ${checkResponse.status} - ${errorText}`);
        
        // Check for permission errors
        if (checkResponse.status === 403) {
          await supabase
            .from("gateways")
            .update({ ttn_last_error: "Permission denied - API key lacks gateways:read permission" })
            .eq("id", gateway_id);
          
          return new Response(
            JSON.stringify({
              success: false,
              error: "Permission denied",
              error_code: "PERMISSION_MISSING",
              hint: "TTN API key must include gateways:read and gateways:write permissions",
              request_id: requestId,
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Step 2: Register gateway in TTN
      console.log(`[ttn-provision-gateway] [${requestId}] Registering gateway in TTN`);
      
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

      // Use user-scoped endpoint for gateway creation (POST /api/v3/gateways returns 501)
      console.log(`[ttn-provision-gateway] [${requestId}] Using user-scoped endpoint: /api/v3/users/${ttnUserId}/gateways`);
      const createResponse = await ttnFetch(`/api/v3/users/${ttnUserId}/gateways`, {
        method: "POST",
        body: JSON.stringify(gatewayPayload),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(`[ttn-provision-gateway] [${requestId}] Registration failed: ${createResponse.status} - ${errorText}`);
        
        let errorCode = "TTN_REQUEST_FAILED";
        let errorMessage = "Failed to register gateway in TTN";
        let hint = "Check TTN console for details";
        
        if (createResponse.status === 403) {
          errorCode = "PERMISSION_MISSING";
          errorMessage = "Permission denied";
          hint = "TTN API key must include gateways:write permission";
        } else if (createResponse.status === 409) {
          errorCode = "CONFLICT";
          errorMessage = "Gateway EUI already registered";
          hint = "This gateway EUI is registered to another TTN account";
        } else if (createResponse.status === 401) {
          errorCode = "INVALID_API_KEY";
          errorMessage = "Invalid API key";
          hint = "Check that your TTN API key is valid and not expired";
        }
        
        await supabase
          .from("gateways")
          .update({ 
            ttn_last_error: `${errorMessage}: ${errorText.substring(0, 200)}`,
          })
          .eq("id", gateway_id);

        return new Response(
          JSON.stringify({
            success: false,
            error: errorMessage,
            error_code: errorCode,
            hint,
            details: errorText,
            request_id: requestId,
          }),
          { status: createResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Success! Update database
      console.log(`[ttn-provision-gateway] [${requestId}] Gateway registered successfully`);
      
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
          success: true,
          gateway_id: ttnGatewayId,
          already_exists: false,
          message: "Gateway registered in TTN successfully",
          request_id: requestId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
            success: false,
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
          success: true, 
          message: "Gateway deleted from TTN",
          request_id: requestId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action", request_id: requestId }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[ttn-provision-gateway] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message, error_code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
