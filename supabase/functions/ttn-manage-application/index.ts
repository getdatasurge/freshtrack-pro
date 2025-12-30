import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManageApplicationRequest {
  action: "create" | "configure_webhook" | "ensure";
  organization_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ttnApiKey = Deno.env.get("TTN_API_KEY");
    const ttnApiBaseUrl = Deno.env.get("TTN_API_BASE_URL");
    const ttnWebhookApiKey = Deno.env.get("TTN_WEBHOOK_API_KEY");

    if (!ttnApiKey || !ttnApiBaseUrl) {
      console.error("TTN credentials not configured");
      return new Response(
        JSON.stringify({ error: "TTN credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: ManageApplicationRequest = await req.json();
    const { action, organization_id } = body;

    console.log(`[ttn-manage-application] Action: ${action}, Org: ${organization_id}`);

    // Fetch organization details
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, slug, name, ttn_application_id, ttn_application_created, ttn_webhook_configured")
      .eq("id", organization_id)
      .single();

    if (orgError || !org) {
      console.error("Organization not found:", orgError);
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ttnAppId = `fg-${org.slug}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    console.log(`[ttn-manage-application] TTN Application ID: ${ttnAppId}`);

    // Helper function for TTN API calls
    const ttnFetch = async (endpoint: string, options: RequestInit = {}) => {
      const url = `${ttnApiBaseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          "Authorization": `Bearer ${ttnApiKey}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      return response;
    };

    // Create or ensure TTN application exists
    if (action === "create" || action === "ensure") {
      if (!org.ttn_application_created) {
        console.log(`[ttn-manage-application] Creating TTN application: ${ttnAppId}`);

        // Try to create the application
        const createResponse = await ttnFetch("/api/v3/applications", {
          method: "POST",
          body: JSON.stringify({
            application: {
              ids: { application_id: ttnAppId },
              name: `FrostGuard - ${org.name}`,
              description: `FrostGuard temperature monitoring for ${org.name}`,
            },
          }),
        });

        if (createResponse.ok) {
          console.log(`[ttn-manage-application] Application created successfully`);
          
          // Update organization with TTN app ID
          await supabase
            .from("organizations")
            .update({
              ttn_application_id: ttnAppId,
              ttn_application_created: true,
            })
            .eq("id", organization_id);
        } else if (createResponse.status === 409) {
          // Application already exists - that's fine, just update our records
          console.log(`[ttn-manage-application] Application already exists in TTN`);
          
          await supabase
            .from("organizations")
            .update({
              ttn_application_id: ttnAppId,
              ttn_application_created: true,
            })
            .eq("id", organization_id);
        } else {
          const errorText = await createResponse.text();
          console.error(`[ttn-manage-application] Failed to create application: ${errorText}`);
          return new Response(
            JSON.stringify({ error: "Failed to create TTN application", details: errorText }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Configure webhook for the application
    if (action === "configure_webhook" || action === "ensure") {
      const { data: updatedOrg } = await supabase
        .from("organizations")
        .select("ttn_application_id, ttn_webhook_configured")
        .eq("id", organization_id)
        .single();

      if (updatedOrg && !updatedOrg.ttn_webhook_configured && updatedOrg.ttn_application_id) {
        console.log(`[ttn-manage-application] Configuring webhook for: ${updatedOrg.ttn_application_id}`);

        const webhookConfig = {
          webhook: {
            ids: {
              webhook_id: "frostguard",
              application_ids: { application_id: updatedOrg.ttn_application_id },
            },
            base_url: `${supabaseUrl}/functions/v1/ttn-webhook`,
            format: "json",
            uplink_message: {},
            join_accept: {},
            headers: ttnWebhookApiKey ? { "X-Webhook-Secret": ttnWebhookApiKey } : {},
          },
        };

        const webhookResponse = await ttnFetch(
          `/api/v3/as/webhooks/${updatedOrg.ttn_application_id}`,
          {
            method: "POST",
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
      .select("ttn_application_id, ttn_application_created, ttn_webhook_configured")
      .eq("id", organization_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        ttn_application_id: finalOrg?.ttn_application_id,
        ttn_application_created: finalOrg?.ttn_application_created,
        ttn_webhook_configured: finalOrg?.ttn_webhook_configured,
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
