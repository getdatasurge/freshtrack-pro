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
  // Version banner for deployment verification
  // ENDPOINT ROUTER: TTN Sandbox Identity Server HTTP API is on eu1; use cluster host only for regional operations
  const BUILD_VERSION = "endpoint-router-v1-20251230";
  console.log(`[ttn-manage-application] Build: ${BUILD_VERSION}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ttnApiKey = Deno.env.get("TTN_API_KEY");
    const ttnApiBaseUrl = Deno.env.get("TTN_API_BASE_URL"); // Regional cluster for AS webhooks
    const ttnIsBaseUrl = Deno.env.get("TTN_IS_BASE_URL") || "https://eu1.cloud.thethings.network"; // Identity Server
    const ttnWebhookApiKey = Deno.env.get("TTN_WEBHOOK_API_KEY");
    const ttnUserId = Deno.env.get("TTN_USER_ID");

    if (!ttnApiKey || !ttnApiBaseUrl || !ttnUserId) {
      console.error("TTN credentials not configured - missing:", {
        apiKey: !ttnApiKey,
        baseUrl: !ttnApiBaseUrl,
        userId: !ttnUserId,
      });
      return new Response(
        JSON.stringify({ error: "TTN credentials not configured (API key, base URL, or user ID missing)" }),
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

    // Use existing ttn_application_id if set, otherwise generate one
    const ttnAppId = org.ttn_application_id || `fg-${org.slug}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    console.log(`[ttn-manage-application] TTN Application ID: ${ttnAppId}`);

    // Normalize base URLs
    const normalizeUrl = (url: string) => {
      let normalized = url.trim().replace(/\/+$/, "");
      if (normalized.endsWith("/api/v3")) {
        normalized = normalized.slice(0, -7);
      }
      return normalized;
    };

    const effectiveIsBaseUrl = normalizeUrl(ttnIsBaseUrl);
    const effectiveRegionalBaseUrl = normalizeUrl(ttnApiBaseUrl);

    console.log(`[ttn-manage-application] Identity Server URL: ${effectiveIsBaseUrl}`);
    console.log(`[ttn-manage-application] Regional Server URL: ${effectiveRegionalBaseUrl}`);

    // Helper for TTN Identity Server API calls (eu1 - for application management)
    const ttnIsFetch = async (endpoint: string, options: RequestInit = {}) => {
      const url = `${effectiveIsBaseUrl}${endpoint}`;
      console.log(`[ttn-manage-application] TTN IS API: ${options.method || "GET"} ${url}`);
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

    // Helper for TTN Regional Server API calls (nam1 - for AS webhooks)
    const ttnRegionalFetch = async (endpoint: string, options: RequestInit = {}) => {
      const url = `${effectiveRegionalBaseUrl}${endpoint}`;
      console.log(`[ttn-manage-application] TTN Regional API: ${options.method || "GET"} ${url}`);
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

    // Create or ensure TTN application exists (Identity Server)
    if (action === "create" || action === "ensure") {
      // If ttn_application_id is already set and marked as created, skip creation
      if (org.ttn_application_id && org.ttn_application_created) {
        console.log(`[ttn-manage-application] TTN application already configured: ${org.ttn_application_id}`);
      } else if (!org.ttn_application_created) {
        console.log(`[ttn-manage-application] Checking if TTN application exists: ${ttnAppId}`);

        // Step 1: Check if application already exists (GET first, then create if needed)
        const checkResponse = await ttnIsFetch(`/api/v3/applications/${ttnAppId}`, {
          method: "GET",
        });

        if (checkResponse.ok) {
          // Application exists! Update our records
          console.log(`[ttn-manage-application] Application ${ttnAppId} already exists in TTN`);
          
          await supabase
            .from("organizations")
            .update({
              ttn_application_id: ttnAppId,
              ttn_application_created: true,
            })
            .eq("id", organization_id);
        } else if (checkResponse.status === 404) {
          // Application doesn't exist, try to create it
          console.log(`[ttn-manage-application] Application not found, attempting to create: ${ttnAppId}`);
          console.log(`[ttn-manage-application] Using TTN user ID: ${ttnUserId}`);
          
          const createResponse = await ttnIsFetch(`/api/v3/users/${ttnUserId}/applications`, {
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
            
            await supabase
              .from("organizations")
              .update({
                ttn_application_id: ttnAppId,
                ttn_application_created: true,
              })
              .eq("id", organization_id);
          } else if (createResponse.status === 409) {
            // Application already exists (race condition) - that's fine
            console.log(`[ttn-manage-application] Application already exists in TTN (409)`);
            
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
            
            // Parse error to check for permission issues
            let errorCode = 0;
            let errorMessage = errorText;
            try {
              const parsed = JSON.parse(errorText);
              errorCode = parsed.code || 0;
              errorMessage = parsed.message || errorText;
            } catch {
              // Keep raw text
            }
            
            // Code 7 = permission denied in gRPC
            if (errorCode === 7 || createResponse.status === 403) {
              return new Response(
                JSON.stringify({ 
                  error: "TTN API key lacks permission to create applications",
                  hint: `Your TTN API key does not have 'applications:create' permission. Please either:
1. Create the application manually in TTN Console with ID: ${ttnAppId}
2. Or generate a new API key with 'All application rights' or 'applications:create' permission`,
                  ttn_app_id: ttnAppId,
                  details: errorMessage,
                }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            
            return new Response(
              JSON.stringify({ error: "Failed to create TTN application", details: errorText }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else if (checkResponse.status === 401) {
          // API key is invalid
          const errorText = await checkResponse.text();
          console.error(`[ttn-manage-application] TTN API authentication failed: ${errorText}`);
          return new Response(
            JSON.stringify({ 
              error: "TTN API authentication failed",
              hint: "Your TTN API key is invalid or expired. Please generate a new one in TTN Console.",
              details: errorText,
            }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else if (checkResponse.status === 403) {
          // API key lacks permission to even read applications
          const errorText = await checkResponse.text();
          console.error(`[ttn-manage-application] TTN API access denied: ${errorText}`);
          return new Response(
            JSON.stringify({ 
              error: "TTN API key lacks required permissions",
              hint: "Your TTN API key needs at least 'applications:read' permission. Please update the key permissions in TTN Console.",
              details: errorText,
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          // Unexpected error
          const errorText = await checkResponse.text();
          console.error(`[ttn-manage-application] TTN API error: ${checkResponse.status} - ${errorText}`);
          return new Response(
            JSON.stringify({ 
              error: `TTN API error (${checkResponse.status})`,
              details: errorText,
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Configure webhook for the application (Application Server - Regional)
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

        // Webhooks are managed by Application Server - use Regional URL
        const webhookResponse = await ttnRegionalFetch(
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
