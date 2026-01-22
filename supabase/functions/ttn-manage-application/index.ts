import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTtnConfigForOrg, getGlobalApplicationId } from "../_shared/ttnConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManageApplicationRequest {
  action: "verify" | "configure_webhook" | "ensure";
  organization_id: string;
}

serve(async (req) => {
  const BUILD_VERSION = "ttn-manage-application-v3-global-app-20251231";
  console.log(`[ttn-manage-application] Build: ${BUILD_VERSION}`);
  console.log(`[ttn-manage-application] Method: ${req.method}, URL: ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check / diagnostics endpoint (GET request)
  if (req.method === "GET") {
    let globalAppId: string | null = null;
    try {
      globalAppId = getGlobalApplicationId();
    } catch {
      // Not set
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        function: "ttn-manage-application",
        version: BUILD_VERSION,
        timestamp: new Date().toISOString(),
        environment: {
          hasSupabaseUrl: !!Deno.env.get("SUPABASE_URL"),
          hasServiceKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
          hasTTNApplicationId: !!globalAppId,
          ttnApplicationId: globalAppId || "not set",
        },
        hint: !globalAppId ? "TTN_APPLICATION_ID environment variable is required" : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ttnWebhookApiKey = Deno.env.get("TTN_WEBHOOK_API_KEY");

    // Get global TTN Application ID
    let ttnAppId: string;
    try {
      ttnAppId = getGlobalApplicationId();
    } catch {
      return new Response(
        JSON.stringify({ 
          error: "TTN not configured", 
          hint: "TTN_APPLICATION_ID environment variable is not set" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: ManageApplicationRequest = await req.json();
    const { action, organization_id } = body;

    console.log(`[ttn-manage-application] Action: ${action}, Org: ${organization_id}, App: ${ttnAppId}`);

    // Fetch organization details
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, slug, name, ttn_webhook_configured")
      .eq("id", organization_id)
      .single();

    if (orgError || !org) {
      console.error("Organization not found:", orgError);
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get TTN config for this org
    const ttnConfig = await getTtnConfigForOrg(supabase, organization_id);

    if (!ttnConfig || !ttnConfig.apiKey) {
      return new Response(
        JSON.stringify({ 
          error: "TTN not configured for this organization",
          hint: "Add a TTN API key in Settings → Developer → TTN Connection"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // NAM1-ONLY: Use clusterBaseUrl for all TTN operations
    const baseUrl = ttnConfig.clusterBaseUrl;
    
    // Import and use HARD GUARD from ttnBase
    const { assertClusterHost } = await import("../_shared/ttnBase.ts");
    assertClusterHost(`${baseUrl}/api/v3/applications/${ttnAppId}`);

    // Verify or ensure the global TTN application exists
    if (action === "verify" || action === "ensure") {
      console.log(`[ttn-manage-application] Verifying TTN application: ${ttnAppId} on ${baseUrl}`);

      const checkResponse = await fetch(
        `${baseUrl}/api/v3/applications/${ttnAppId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${ttnConfig.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (checkResponse.ok) {
        console.log(`[ttn-manage-application] Application ${ttnAppId} verified`);
      } else if (checkResponse.status === 401) {
        const errorText = await checkResponse.text();
        return new Response(
          JSON.stringify({ 
            error: "TTN API authentication failed",
            hint: "Your TTN API key is invalid or expired",
            details: errorText,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (checkResponse.status === 403) {
        const errorText = await checkResponse.text();
        return new Response(
          JSON.stringify({ 
            error: "TTN API key lacks required permissions",
            hint: `Your TTN API key needs access to application: ${ttnAppId}`,
            details: errorText,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (checkResponse.status === 404) {
        return new Response(
          JSON.stringify({ 
            error: "TTN application not found",
            hint: `Application '${ttnAppId}' does not exist. Contact your administrator to verify TTN_APPLICATION_ID.`,
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const errorText = await checkResponse.text();
        return new Response(
          JSON.stringify({ 
            error: `TTN API error (${checkResponse.status})`,
            details: errorText,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Configure webhook for the application
    if (action === "configure_webhook" || action === "ensure") {
      if (!org.ttn_webhook_configured) {
        console.log(`[ttn-manage-application] Configuring webhook for: ${ttnAppId}`);

        const webhookConfig = {
          webhook: {
            ids: {
              webhook_id: "frostguard",
              application_ids: { application_id: ttnAppId },
            },
            base_url: `${supabaseUrl}/functions/v1/ttn-webhook`,
            format: "json",
            uplink_message: {},
            join_accept: {},
            headers: ttnWebhookApiKey ? { "X-Webhook-Secret": ttnWebhookApiKey } : {},
          },
        };

        // NAM1-ONLY: Webhooks use same clusterBaseUrl
        const webhookResponse = await fetch(
          `${baseUrl}/api/v3/as/webhooks/${ttnAppId}`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${ttnConfig.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(webhookConfig),
          }
        );

        if (webhookResponse.ok || webhookResponse.status === 409) {
          console.log(`[ttn-manage-application] Webhook configured successfully`);
          
          await supabase
            .from("organizations")
            .update({ ttn_webhook_configured: true })
            .eq("id", organization_id);
        } else {
          const errorText = await webhookResponse.text();
          console.warn(`[ttn-manage-application] Webhook configuration warning: ${errorText}`);
          // Don't fail the whole request - webhook can be configured later
        }
      }
    }

    // Fetch final state
    const { data: finalOrg } = await supabase
      .from("organizations")
      .select("ttn_webhook_configured")
      .eq("id", organization_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        ttn_application_id: ttnAppId,
        ttn_webhook_configured: finalOrg?.ttn_webhook_configured || false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[ttn-manage-application] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
