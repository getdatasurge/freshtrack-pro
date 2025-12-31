/**
 * TTN Organization Provisioning Edge Function
 * 
 * Creates a complete TTN application infrastructure for an organization:
 * - Creates TTN Application (freshtracker-{org-slug})
 * - Creates application-scoped API key with required permissions
 * - Creates webhook pointing to our ttn-webhook endpoint
 * - Saves all credentials to ttn_connections table
 * 
 * Security:
 * - Requires admin/owner role in the organization
 * - Uses TTN_ADMIN_API_KEY for creating applications (platform-level key)
 * - Generates unique webhook secret per organization
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  generateTtnApplicationId, 
  generateWebhookSecret,
  obfuscateKey,
  getLast4,
} from "../_shared/ttnConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProvisionOrgRequest {
  action: "provision" | "status" | "delete" | "regenerate_webhook_secret";
  organization_id: string;
  ttn_region?: string;
}

const REGIONAL_URLS: Record<string, string> = {
  nam1: "https://nam1.cloud.thethings.network",
  eu1: "https://eu1.cloud.thethings.network",
  au1: "https://au1.cloud.thethings.network",
  as1: "https://as1.cloud.thethings.network",
};

const IDENTITY_SERVER_URL = "https://eu1.cloud.thethings.network";

// Frequency plan mapping by region
const FREQUENCY_PLANS: Record<string, string> = {
  nam1: "US_902_928_FSB_2",
  eu1: "EU_863_870_TTN",
  au1: "AU_915_928_FSB_2",
  as1: "AS_923_925_LBT",
};

serve(async (req) => {
  const BUILD_VERSION = "ttn-provision-org-v1.1-webhook-fix-20251231";
  console.log(`[ttn-provision-org] Build: ${BUILD_VERSION}`);
  console.log(`[ttn-provision-org] Method: ${req.method}, URL: ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (req.method === "GET") {
    const hasTtnAdminKey = !!Deno.env.get("TTN_ADMIN_API_KEY");
    const hasTtnUserId = !!Deno.env.get("TTN_USER_ID");
    
    return new Response(
      JSON.stringify({
        status: "ok",
        function: "ttn-provision-org",
        version: BUILD_VERSION,
        timestamp: new Date().toISOString(),
        environment: {
          hasSupabaseUrl: !!Deno.env.get("SUPABASE_URL"),
          hasServiceKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
          hasTtnAdminKey,
          hasTtnUserId,
          ready: hasTtnAdminKey && hasTtnUserId,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ttnAdminKey = Deno.env.get("TTN_ADMIN_API_KEY");
    const ttnUserId = Deno.env.get("TTN_USER_ID");
    const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") || supabaseServiceKey?.slice(0, 32) || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ttnAdminKey || !ttnUserId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "TTN admin credentials not configured",
          hint: "Contact your administrator to set up TTN_ADMIN_API_KEY and TTN_USER_ID secrets",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: ProvisionOrgRequest = await req.json();
    const { action, organization_id, ttn_region } = body;
    const region = (ttn_region || "nam1").toLowerCase();

    console.log(`[ttn-provision-org] Action: ${action}, Org: ${organization_id}, Region: ${region}`);

    // Verify user is admin/owner
    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (!roleCheck || !["owner", "admin"].includes(roleCheck.role)) {
      return new Response(
        JSON.stringify({ error: "Only admins and owners can manage TTN provisioning" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", organization_id)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create ttn_connections record
    let { data: ttnConn } = await supabase
      .from("ttn_connections")
      .select("*")
      .eq("organization_id", organization_id)
      .maybeSingle();

    // ========================================
    // ACTION: STATUS - Get current provisioning status
    // ========================================
    if (action === "status") {
      return new Response(
        JSON.stringify({
          success: true,
          provisioning_status: ttnConn?.provisioning_status || "not_started",
          ttn_application_id: ttnConn?.ttn_application_id || null,
          ttn_region: ttnConn?.ttn_region || "nam1",
          has_api_key: !!ttnConn?.ttn_api_key_encrypted,
          has_webhook_secret: !!ttnConn?.ttn_webhook_secret_encrypted,
          webhook_url: ttnConn?.ttn_webhook_url || null,
          provisioned_at: ttnConn?.ttn_application_provisioned_at || null,
          error: ttnConn?.provisioning_error || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // ACTION: REGENERATE_WEBHOOK_SECRET
    // ========================================
    if (action === "regenerate_webhook_secret") {
      if (!ttnConn?.ttn_application_id) {
        return new Response(
          JSON.stringify({ error: "TTN application not provisioned yet" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newSecret = generateWebhookSecret();
      const encryptedSecret = obfuscateKey(newSecret, encryptionSalt);
      
      // Update webhook in TTN with new secret
      const webhookUrl = `${supabaseUrl}/functions/v1/ttn-webhook`;
      const regionalUrl = REGIONAL_URLS[region] || REGIONAL_URLS.nam1;
      
      const updateWebhookResponse = await fetch(
        `${regionalUrl}/api/v3/as/webhooks/${ttnConn.ttn_application_id}/freshtracker`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${ttnAdminKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            webhook: {
              ids: {
                webhook_id: "freshtracker",
                application_ids: { application_id: ttnConn.ttn_application_id },
              },
              base_url: webhookUrl,
              headers: {
                "X-Webhook-Secret": newSecret,
              },
            },
            field_mask: {
              paths: ["headers", "base_url"],
            },
          }),
        }
      );

      if (!updateWebhookResponse.ok) {
        const errorText = await updateWebhookResponse.text();
        console.error(`[ttn-provision-org] Failed to update webhook: ${errorText}`);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update webhook in TTN", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save new secret to database
      await supabase
        .from("ttn_connections")
        .update({
          ttn_webhook_secret_encrypted: encryptedSecret,
          ttn_webhook_secret_last4: getLast4(newSecret),
          updated_by: user.id,
        })
        .eq("id", ttnConn.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Webhook secret regenerated",
          webhook_secret_last4: getLast4(newSecret),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // ACTION: PROVISION - Create TTN application for org
    // ========================================
    if (action === "provision") {
      // Check if already provisioned
      if (ttnConn?.ttn_application_id && ttnConn.provisioning_status === "completed") {
        return new Response(
          JSON.stringify({
            success: true,
            message: "TTN application already provisioned",
            ttn_application_id: ttnConn.ttn_application_id,
            provisioning_status: "completed",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate TTN application ID
      const ttnAppId = generateTtnApplicationId(org.slug);
      console.log(`[ttn-provision-org] Provisioning TTN app: ${ttnAppId}`);

      // Update status to provisioning
      if (ttnConn) {
        await supabase
          .from("ttn_connections")
          .update({
            provisioning_status: "provisioning",
            provisioning_error: null,
            ttn_region: region,
            updated_by: user.id,
          })
          .eq("id", ttnConn.id);
      } else {
        const { data: newConn } = await supabase
          .from("ttn_connections")
          .insert({
            organization_id: organization_id,
            ttn_region: region,
            provisioning_status: "provisioning",
            created_by: user.id,
          })
          .select()
          .single();
        ttnConn = newConn;
      }

      try {
        // Step 1: Create TTN Application
        console.log(`[ttn-provision-org] Step 1: Creating TTN application ${ttnAppId}`);
        
        const createAppResponse = await fetch(
          `${IDENTITY_SERVER_URL}/api/v3/users/${ttnUserId}/applications`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${ttnAdminKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              application: {
                ids: { application_id: ttnAppId },
                name: `FreshTracker - ${org.name}`,
                description: `FreshTracker temperature monitoring for ${org.name}`,
              },
            }),
          }
        );

        if (!createAppResponse.ok && createAppResponse.status !== 409) {
          const errorText = await createAppResponse.text();
          throw new Error(`Failed to create application: ${createAppResponse.status} - ${errorText}`);
        }

        // Step 2: Create API Key for this application
        console.log(`[ttn-provision-org] Step 2: Creating API key for ${ttnAppId}`);
        
        const createKeyResponse = await fetch(
          `${IDENTITY_SERVER_URL}/api/v3/applications/${ttnAppId}/api-keys`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${ttnAdminKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "FreshTracker Integration",
              rights: [
                "RIGHT_APPLICATION_INFO",
                "RIGHT_APPLICATION_DEVICES_READ",
                "RIGHT_APPLICATION_DEVICES_WRITE",
                "RIGHT_APPLICATION_TRAFFIC_READ",
                "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE",
              ],
            }),
          }
        );

        if (!createKeyResponse.ok) {
          const errorText = await createKeyResponse.text();
          throw new Error(`Failed to create API key: ${createKeyResponse.status} - ${errorText}`);
        }

        const keyData = await createKeyResponse.json();
        const newApiKey = keyData.key;
        const apiKeyId = keyData.id;

        // Step 3: Create webhook
        console.log(`[ttn-provision-org] Step 3: Creating webhook for ${ttnAppId}`);
        
        const webhookSecret = generateWebhookSecret();
        const webhookUrl = `${supabaseUrl}/functions/v1/ttn-webhook`;
        const regionalUrl = REGIONAL_URLS[region] || REGIONAL_URLS.nam1;

        const createWebhookResponse = await fetch(
          `${regionalUrl}/api/v3/as/webhooks/${ttnAppId}`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${newApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              webhook: {
                ids: {
                  webhook_id: "freshtracker",
                  application_ids: { application_id: ttnAppId },
                },
                base_url: webhookUrl,
                format: "json",
                headers: {
                  "X-Webhook-Secret": webhookSecret,
                },
                uplink_message: {},
                join_accept: {},
              },
            }),
          }
        );

        if (!createWebhookResponse.ok) {
          const errorText = await createWebhookResponse.text();
          console.warn(`[ttn-provision-org] Webhook creation warning: ${errorText}`);
          // Continue anyway - webhook can be created later
        }

        // Step 4: Save all credentials to database
        console.log(`[ttn-provision-org] Step 4: Saving credentials to database`);
        
        const encryptedApiKey = obfuscateKey(newApiKey, encryptionSalt);
        const encryptedWebhookSecret = obfuscateKey(webhookSecret, encryptionSalt);

        await supabase
          .from("ttn_connections")
          .update({
            ttn_application_id: ttnAppId,
            ttn_application_name: `FreshTracker - ${org.name}`,
            ttn_api_key_encrypted: encryptedApiKey,
            ttn_api_key_last4: getLast4(newApiKey),
            ttn_api_key_id: apiKeyId,
            ttn_api_key_updated_at: new Date().toISOString(),
            ttn_webhook_secret_encrypted: encryptedWebhookSecret,
            ttn_webhook_secret_last4: getLast4(webhookSecret),
            ttn_webhook_url: webhookUrl,
            ttn_webhook_id: "freshtracker",
            provisioning_status: "completed",
            provisioning_error: null,
            ttn_application_provisioned_at: new Date().toISOString(),
            is_enabled: true,
            updated_by: user.id,
          })
          .eq("organization_id", organization_id);

        // Log success event
        await supabase.from("event_logs").insert({
          organization_id: organization_id,
          event_type: "ttn.application.provisioned",
          category: "settings",
          severity: "info",
          title: "TTN Application Provisioned",
          actor_id: user.id,
          event_data: {
            ttn_application_id: ttnAppId,
            region,
            webhook_url: webhookUrl,
          },
        });

        console.log(`[ttn-provision-org] Provisioning complete for ${ttnAppId}`);

        return new Response(
          JSON.stringify({
            success: true,
            ttn_application_id: ttnAppId,
            provisioning_status: "completed",
            webhook_url: webhookUrl,
            api_key_last4: getLast4(newApiKey),
            webhook_secret_last4: getLast4(webhookSecret),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (provisionError) {
        const errorMessage = provisionError instanceof Error ? provisionError.message : "Unknown error";
        console.error(`[ttn-provision-org] Provisioning failed:`, provisionError);

        // Save error to database
        await supabase
          .from("ttn_connections")
          .update({
            provisioning_status: "failed",
            provisioning_error: errorMessage,
          })
          .eq("organization_id", organization_id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Provisioning failed",
            details: errorMessage,
            provisioning_status: "failed",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========================================
    // ACTION: DELETE - Remove TTN application
    // ========================================
    if (action === "delete") {
      if (!ttnConn?.ttn_application_id) {
        return new Response(
          JSON.stringify({ success: true, message: "No TTN application to delete" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Delete the TTN application (this also deletes all devices and webhooks)
        const deleteResponse = await fetch(
          `${IDENTITY_SERVER_URL}/api/v3/applications/${ttnConn.ttn_application_id}`,
          {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${ttnAdminKey}`,
            },
          }
        );

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          const errorText = await deleteResponse.text();
          throw new Error(`Failed to delete application: ${deleteResponse.status} - ${errorText}`);
        }

        // Clear TTN settings
        await supabase
          .from("ttn_connections")
          .update({
            ttn_application_id: null,
            ttn_application_name: null,
            ttn_api_key_encrypted: null,
            ttn_api_key_last4: null,
            ttn_api_key_id: null,
            ttn_webhook_secret_encrypted: null,
            ttn_webhook_secret_last4: null,
            ttn_webhook_url: null,
            provisioning_status: "not_started",
            provisioning_error: null,
            ttn_application_provisioned_at: null,
            is_enabled: false,
            updated_by: user.id,
          })
          .eq("organization_id", organization_id);

        // Log event
        await supabase.from("event_logs").insert({
          organization_id: organization_id,
          event_type: "ttn.application.deleted",
          category: "settings",
          severity: "warning",
          title: "TTN Application Deleted",
          actor_id: user.id,
          event_data: {
            ttn_application_id: ttnConn.ttn_application_id,
          },
        });

        return new Response(
          JSON.stringify({ success: true, message: "TTN application deleted" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (deleteError) {
        const errorMessage = deleteError instanceof Error ? deleteError.message : "Unknown error";
        console.error(`[ttn-provision-org] Delete failed:`, deleteError);

        return new Response(
          JSON.stringify({ success: false, error: "Delete failed", details: errorMessage }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ttn-provision-org] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
