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
  deobfuscateKey,
  getLast4,
} from "../_shared/ttnConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProvisionOrgRequest {
  action: "provision" | "status" | "delete" | "regenerate_webhook_secret" | "verify_webhook";
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

      // Get the org's API key - prefer org's own key over admin key
      let apiKeyToUse = ttnAdminKey;
      if (ttnConn.ttn_api_key_encrypted) {
        const decryptedOrgKey = deobfuscateKey(ttnConn.ttn_api_key_encrypted, encryptionSalt);
        if (decryptedOrgKey) {
          apiKeyToUse = decryptedOrgKey;
          console.log(`[ttn-provision-org] Using org's own API key (last4: ${ttnConn.ttn_api_key_last4})`);
        }
      }

      // Use the region from the database, not the request body
      const storedRegion = (ttnConn.ttn_region || "nam1").toLowerCase();
      const regionalUrl = REGIONAL_URLS[storedRegion] || REGIONAL_URLS.nam1;
      const webhookId = ttnConn.ttn_webhook_id || "freshtracker";

      console.log(`[ttn-provision-org] Regenerating webhook secret for ${ttnConn.ttn_application_id} on ${storedRegion}`);

      const newSecret = generateWebhookSecret();
      const encryptedSecret = obfuscateKey(newSecret, encryptionSalt);

      // Update webhook in TTN with new secret
      const webhookUrl = ttnConn.ttn_webhook_url || `${supabaseUrl}/functions/v1/ttn-webhook`;

      const updateWebhookResponse = await fetch(
        `${regionalUrl}/api/v3/as/webhooks/${ttnConn.ttn_application_id}/${webhookId}`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${apiKeyToUse}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            webhook: {
              ids: {
                webhook_id: webhookId,
                application_ids: { application_id: ttnConn.ttn_application_id },
              },
              base_url: webhookUrl,
              format: "json",
              headers: {
                "X-Webhook-Secret": newSecret,
              },
              uplink_message: {},
              join_accept: {},
            },
            field_mask: {
              paths: ["headers", "base_url", "format", "uplink_message", "join_accept"],
            },
          }),
        }
      );

      if (!updateWebhookResponse.ok) {
        const errorText = await updateWebhookResponse.text();
        console.error(`[ttn-provision-org] Failed to update webhook: ${updateWebhookResponse.status} ${errorText}`);

        // Provide helpful error messages
        let errorMsg = "Failed to update webhook in TTN";
        let hint = errorText.slice(0, 200);

        if (updateWebhookResponse.status === 401) {
          errorMsg = "API key authentication failed";
          hint = "The stored API key may be invalid or expired. Try updating the API key in TTN settings.";
        } else if (updateWebhookResponse.status === 403) {
          errorMsg = "API key lacks webhook write permission";
          hint = "Create a new API key with 'Write application settings' permission in TTN Console.";
        } else if (updateWebhookResponse.status === 404) {
          errorMsg = "Webhook not found in TTN";
          hint = "The webhook may have been deleted. Try saving the TTN configuration again to recreate it.";
        }

        return new Response(
          JSON.stringify({ success: false, error: errorMsg, hint, details: errorText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

      // Log event
      await supabase.from("event_logs").insert({
        organization_id: organization_id,
        event_type: "ttn.webhook_secret.regenerated",
        category: "settings",
        severity: "info",
        title: "TTN Webhook Secret Regenerated",
        actor_id: user.id,
        event_data: {
          ttn_application_id: ttnConn.ttn_application_id,
          region: storedRegion,
        },
      });

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
    // ACTION: VERIFY_WEBHOOK - Check webhook sync status
    // ========================================
    if (action === "verify_webhook") {
      if (!ttnConn?.ttn_application_id) {
        return new Response(
          JSON.stringify({
            success: true,
            status: "not_configured",
            message: "TTN application not provisioned yet",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the org's API key
      let apiKeyToUse = ttnAdminKey;
      if (ttnConn.ttn_api_key_encrypted) {
        const decryptedOrgKey = deobfuscateKey(ttnConn.ttn_api_key_encrypted, encryptionSalt);
        if (decryptedOrgKey) {
          apiKeyToUse = decryptedOrgKey;
        }
      }

      const storedRegion = (ttnConn.ttn_region || "nam1").toLowerCase();
      const regionalUrl = REGIONAL_URLS[storedRegion] || REGIONAL_URLS.nam1;
      const webhookId = ttnConn.ttn_webhook_id || "freshtracker";
      const expectedWebhookUrl = ttnConn.ttn_webhook_url || `${supabaseUrl}/functions/v1/ttn-webhook`;

      console.log(`[ttn-provision-org] Verifying webhook ${webhookId} for ${ttnConn.ttn_application_id}`);

      try {
        const getWebhookResponse = await fetch(
          `${regionalUrl}/api/v3/as/webhooks/${ttnConn.ttn_application_id}/${webhookId}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKeyToUse}`,
              "Accept": "application/json",
            },
          }
        );

        if (!getWebhookResponse.ok) {
          if (getWebhookResponse.status === 404) {
            return new Response(
              JSON.stringify({
                success: true,
                status: "not_found",
                message: "Webhook not found in TTN",
                hint: "The webhook may have been deleted. Save your TTN configuration to recreate it.",
                expected: {
                  webhook_id: webhookId,
                  base_url: expectedWebhookUrl,
                },
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (getWebhookResponse.status === 401 || getWebhookResponse.status === 403) {
            return new Response(
              JSON.stringify({
                success: false,
                status: "auth_error",
                message: "Cannot verify webhook - API key lacks permission",
                hint: "Update your API key with 'Read application settings' permission.",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const errorText = await getWebhookResponse.text();
          return new Response(
            JSON.stringify({
              success: false,
              status: "error",
              message: `TTN API error (${getWebhookResponse.status})`,
              details: errorText.slice(0, 200),
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const webhookData = await getWebhookResponse.json();
        const ttnWebhook = webhookData.webhook || webhookData;

        // Compare configurations
        const differences: string[] = [];

        const ttnBaseUrl = ttnWebhook.base_url || "";
        if (ttnBaseUrl !== expectedWebhookUrl) {
          differences.push(`URL: TTN has "${ttnBaseUrl}", expected "${expectedWebhookUrl}"`);
        }

        const ttnFormat = ttnWebhook.format || "json";
        if (ttnFormat !== "json") {
          differences.push(`Format: TTN has "${ttnFormat}", expected "json"`);
        }

        // Check if secret header is configured (we can't compare the actual value)
        const ttnHeaders = ttnWebhook.headers || {};
        const hasSecretHeader = "X-Webhook-Secret" in ttnHeaders || "x-webhook-secret" in ttnHeaders;
        if (!hasSecretHeader && ttnConn.ttn_webhook_secret_encrypted) {
          differences.push("Secret: TTN webhook has no X-Webhook-Secret header configured");
        }

        // Check enabled events
        const hasUplinkMessage = ttnWebhook.uplink_message !== undefined;
        const hasJoinAccept = ttnWebhook.join_accept !== undefined;
        if (!hasUplinkMessage) {
          differences.push("Events: uplink_message not enabled");
        }
        if (!hasJoinAccept) {
          differences.push("Events: join_accept not enabled");
        }

        const isInSync = differences.length === 0;

        return new Response(
          JSON.stringify({
            success: true,
            status: isInSync ? "in_sync" : "out_of_sync",
            message: isInSync ? "Webhook configuration is in sync" : "Webhook configuration differs",
            differences: isInSync ? [] : differences,
            ttn_config: {
              webhook_id: ttnWebhook.ids?.webhook_id || webhookId,
              base_url: ttnBaseUrl,
              format: ttnFormat,
              has_secret_header: hasSecretHeader,
              uplink_message_enabled: hasUplinkMessage,
              join_accept_enabled: hasJoinAccept,
            },
            expected_config: {
              webhook_id: webhookId,
              base_url: expectedWebhookUrl,
              format: "json",
              has_secret_header: !!ttnConn.ttn_webhook_secret_encrypted,
              uplink_message_enabled: true,
              join_accept_enabled: true,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (fetchError) {
        console.error(`[ttn-provision-org] Verify webhook error:`, fetchError);
        return new Response(
          JSON.stringify({
            success: false,
            status: "network_error",
            message: "Failed to connect to TTN",
            hint: fetchError instanceof Error ? fetchError.message : "Check network connectivity",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

        // Enhanced webhook creation with retry and PUT fallback
        let webhookCreated = false;
        for (let attempt = 0; attempt < 2; attempt++) {
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
                  headers: { "X-Webhook-Secret": webhookSecret },
                  uplink_message: {},
                  join_accept: {},
                },
              }),
            }
          );

          if (createWebhookResponse.ok) {
            webhookCreated = true;
            console.log(`[ttn-provision-org] Webhook created successfully`);
            break;
          } else if (createWebhookResponse.status === 409) {
            // Webhook exists, try PUT to update
            console.log(`[ttn-provision-org] Webhook exists, updating...`);
            const updateResponse = await fetch(
              `${regionalUrl}/api/v3/as/webhooks/${ttnAppId}/freshtracker`,
              {
                method: "PUT",
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
                    headers: { "X-Webhook-Secret": webhookSecret },
                    uplink_message: {},
                    join_accept: {},
                  },
                  field_mask: {
                    paths: ["headers", "base_url", "format", "uplink_message", "join_accept"],
                  },
                }),
              }
            );
            if (updateResponse.ok) {
              webhookCreated = true;
              console.log(`[ttn-provision-org] Webhook updated successfully`);
              break;
            } else {
              const updateError = await updateResponse.text();
              console.warn(`[ttn-provision-org] Webhook update failed: ${updateError}`);
            }
          } else {
            const errorText = await createWebhookResponse.text();
            console.warn(`[ttn-provision-org] Webhook creation attempt ${attempt + 1} failed: ${errorText}`);
          }

          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 500)); // Brief delay before retry
          }
        }

        if (!webhookCreated) {
          console.warn(`[ttn-provision-org] Webhook creation failed - will need manual setup`);
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
            webhook_created: webhookCreated,
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
