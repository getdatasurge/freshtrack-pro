import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  getTtnConfigForOrg, 
  testTtnConnection, 
  obfuscateKey, 
  getLast4,
  generateTtnDeviceId,
} from "../_shared/ttnConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TTNSettingsUpdate {
  is_enabled?: boolean;
  ttn_region?: string;
  api_key?: string; // Allow direct API key updates from FrostGuard UI
}

Deno.serve(async (req: Request) => {
  const BUILD_VERSION = "manage-ttn-settings-v5-perorg-20251231";
  console.log(`[manage-ttn-settings] Build: ${BUILD_VERSION}`);
  console.log(`[manage-ttn-settings] Method: ${req.method}, URL: ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get authorization header for user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body to get action
    let body: { action?: string; organization_id?: string; [key: string]: unknown } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine for "get" action
    }
    const action = body.action || "get";
    console.log(`[manage-ttn-settings] Action: ${action}`);

    // Create service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Extract the token from the header
    const token = authHeader.startsWith("Bearer ") 
      ? authHeader.slice(7).trim() 
      : authHeader.trim();

    // Verify user via token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error("[manage-ttn-settings] User verification failed:", userError?.message || "No user");
      return new Response(
        JSON.stringify({ error: "Invalid user session", details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[manage-ttn-settings] User verified: ${user.id}`);

    // Determine organization ID
    let organizationId = body.organization_id as string | undefined;
    
    if (!organizationId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      organizationId = profile?.organization_id;
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is admin/owner of this org
    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!roleCheck || !["owner", "admin"].includes(roleCheck.role)) {
      return new Response(
        JSON.stringify({ error: "Only admins and owners can manage TTN settings" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET action - Fetch current settings (per-org model)
    if (action === "get") {
      console.log(`[manage-ttn-settings] GET settings for org: ${organizationId}`);

      const { data: settings } = await supabaseAdmin
        .from("ttn_connections")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();

      // If no settings exist, return empty state
      if (!settings) {
        return new Response(
          JSON.stringify({
            exists: false,
            is_enabled: false,
            ttn_region: "nam1",
            ttn_application_id: null,
            provisioning_status: "not_started",
            has_api_key: false,
            api_key_last4: null,
            api_key_updated_at: null,
            has_webhook_secret: false,
            webhook_secret_last4: null,
            webhook_url: null,
            last_connection_test_at: null,
            last_connection_test_result: null,
            last_updated_source: null,
            last_test_source: null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Return settings with masked keys and source tracking
      return new Response(
        JSON.stringify({
          exists: true,
          is_enabled: settings.is_enabled,
          ttn_region: settings.ttn_region || "nam1",
          ttn_application_id: settings.ttn_application_id,
          ttn_application_name: settings.ttn_application_name,
          provisioning_status: settings.provisioning_status || "not_started",
          provisioning_error: settings.provisioning_error,
          provisioned_at: settings.ttn_application_provisioned_at,
          has_api_key: !!settings.ttn_api_key_encrypted,
          api_key_last4: settings.ttn_api_key_last4,
          api_key_updated_at: settings.ttn_api_key_updated_at,
          has_webhook_secret: !!settings.ttn_webhook_secret_encrypted,
          webhook_secret_last4: settings.ttn_webhook_secret_last4,
          webhook_url: settings.ttn_webhook_url,
          last_connection_test_at: settings.last_connection_test_at,
          last_connection_test_result: settings.last_connection_test_result,
          last_updated_source: settings.ttn_last_updated_source,
          last_test_source: settings.ttn_last_test_source,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TEST action - Test TTN connection using org's own application
    if (action === "test") {
      const sensorId = body.sensor_id as string | undefined;
      console.log(`[manage-ttn-settings] Testing TTN connection for org: ${organizationId}`);

      // Get config for this org
      const config = await getTtnConfigForOrg(supabaseAdmin, organizationId);

      // Also get the raw ttn_connections row for api_key_last4
      const { data: ttnConnData } = await supabaseAdmin
        .from("ttn_connections")
        .select("ttn_api_key_last4, ttn_last_updated_source")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (!config || !config.applicationId) {
        const testResult = {
          success: false,
          error: "TTN application not provisioned",
          hint: "Click 'Provision TTN Application' to create your organization's TTN application.",
          testedAt: new Date().toISOString(),
          endpointTested: "",
          effectiveApplicationId: "",
          clusterTested: "",
        };

        return new Response(
          JSON.stringify(testResult),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!config.apiKey) {
        const testResult = {
          success: false,
          error: "No API key configured",
          hint: "TTN application exists but API key is missing. Try re-provisioning or enter a new API key.",
          testedAt: new Date().toISOString(),
          endpointTested: "",
          effectiveApplicationId: config.applicationId,
          clusterTested: config.region,
          api_key_last4: ttnConnData?.ttn_api_key_last4,
          last_updated_source: ttnConnData?.ttn_last_updated_source,
        };

        // Save test result
        await supabaseAdmin
          .from("ttn_connections")
          .update({
            last_connection_test_at: new Date().toISOString(),
            last_connection_test_result: testResult,
            ttn_last_test_source: "frostguard",
          })
          .eq("organization_id", organizationId);

        return new Response(
          JSON.stringify(testResult),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If sensor_id provided, look up the ttn_device_id for device-specific testing
      let testDeviceId: string | undefined = undefined;
      
      if (sensorId) {
        const { data: sensor } = await supabaseAdmin
          .from("lora_sensors")
          .select("dev_eui, ttn_device_id")
          .eq("id", sensorId)
          .eq("organization_id", organizationId)
          .single();
        
        if (sensor) {
          testDeviceId = sensor.ttn_device_id || generateTtnDeviceId(sensor.dev_eui) || undefined;
          console.log(`[manage-ttn-settings] Testing device: ${testDeviceId}`);
        }
      }

      // Run the test
      const testResult = await testTtnConnection(config, { testDeviceId });

      // Enhance test result with source and key info from ttn_connections
      const enhancedTestResult = {
        ...testResult,
        api_key_last4: ttnConnData?.ttn_api_key_last4,
        last_updated_source: ttnConnData?.ttn_last_updated_source,
        source: "frostguard",
      };

      // Save test result with source tracking
      await supabaseAdmin
        .from("ttn_connections")
        .update({
          last_connection_test_at: testResult.testedAt,
          last_connection_test_result: enhancedTestResult,
          ttn_last_test_source: "frostguard",
        })
        .eq("organization_id", organizationId);

      // Log to event_logs
      await supabaseAdmin.from("event_logs").insert({
        organization_id: organizationId,
        event_type: testResult.success ? "ttn.settings.tested" : "ttn.settings.test_failed",
        category: "settings",
        severity: testResult.success ? "info" : "warning",
        title: testResult.success ? "TTN Connection Test Passed" : "TTN Connection Test Failed",
        actor_id: user.id,
        event_data: { 
          result: testResult,
          application_id: config.applicationId,
          region: config.region,
          tested_device_id: testDeviceId,
        },
      });

      return new Response(
        JSON.stringify(enhancedTestResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UPDATE action - Update settings (enabled, region, and API key)
    if (action === "update") {
      console.log(`[manage-ttn-settings] Updating settings for org: ${organizationId}`);

      const updates: TTNSettingsUpdate = body as TTNSettingsUpdate;
      console.log(`[manage-ttn-settings] Updates:`, { 
        is_enabled: updates.is_enabled,
        ttn_region: updates.ttn_region,
        has_api_key: !!updates.api_key,
      });

      // Validate: if enabling, require provisioned application
      if (updates.is_enabled === true) {
        const { data: existingCheck } = await supabaseAdmin
          .from("ttn_connections")
          .select("ttn_application_id, provisioning_status")
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (!existingCheck?.ttn_application_id || existingCheck.provisioning_status !== "completed") {
          return new Response(
            JSON.stringify({ 
              error: "TTN application required", 
              details: "You must provision a TTN application before enabling TTN integration." 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Get encryption salt - MUST match _shared/ttnConfig.ts pattern
      const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") || supabaseServiceKey.slice(0, 32);

      // Build update object
      const dbUpdates: Record<string, unknown> = {
        updated_by: user.id,
        ttn_last_updated_source: "frostguard",
      };

      if (updates.is_enabled !== undefined) dbUpdates.is_enabled = updates.is_enabled;
      if (updates.ttn_region !== undefined) dbUpdates.ttn_region = updates.ttn_region.toLowerCase();

      // Handle API key update
      if (updates.api_key) {
        dbUpdates.ttn_api_key_encrypted = obfuscateKey(updates.api_key, encryptionSalt);
        dbUpdates.ttn_api_key_last4 = getLast4(updates.api_key);
        dbUpdates.ttn_api_key_updated_at = new Date().toISOString();
        // Clear stale test result when key changes
        dbUpdates.last_connection_test_result = null;
        dbUpdates.last_connection_test_at = null;
        
        console.log(`[manage-ttn-settings] API key updated, last4: ${dbUpdates.ttn_api_key_last4}`);
      }

      // Check if record exists
      const { data: existing } = await supabaseAdmin
        .from("ttn_connections")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle();

      let result;
      if (existing) {
        result = await supabaseAdmin
          .from("ttn_connections")
          .update(dbUpdates)
          .eq("id", existing.id)
          .select()
          .single();
      } else {
        result = await supabaseAdmin
          .from("ttn_connections")
          .insert({
            organization_id: organizationId,
            created_by: user.id,
            ttn_region: "nam1",
            ...dbUpdates,
          })
          .select()
          .single();
      }

      if (result.error) {
        console.error("[manage-ttn-settings] Database error:", result.error);
        return new Response(
          JSON.stringify({ error: "Failed to save settings", details: result.error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log to event_logs
      const changedFields: string[] = [];
      if (updates.is_enabled !== undefined) changedFields.push("is_enabled");
      if (updates.ttn_region !== undefined) changedFields.push("ttn_region");
      if (updates.api_key) changedFields.push("api_key");

      const eventType = updates.api_key 
        ? "ttn.settings.api_key_updated"
        : updates.is_enabled !== undefined 
          ? (updates.is_enabled ? "ttn.settings.enabled" : "ttn.settings.disabled")
          : "ttn.settings.updated";

      await supabaseAdmin.from("event_logs").insert({
        organization_id: organizationId,
        event_type: eventType,
        category: "settings",
        severity: "info",
        title: updates.api_key 
          ? "TTN API Key Updated"
          : updates.is_enabled !== undefined
            ? (updates.is_enabled ? "TTN Integration Enabled" : "TTN Integration Disabled")
            : "TTN Settings Updated",
        actor_id: user.id,
        event_data: {
          changed_fields: changedFields,
          is_enabled: result.data.is_enabled,
          application_id: result.data.ttn_application_id,
          api_key_last4: result.data.ttn_api_key_last4,
          source: "frostguard",
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          is_enabled: result.data.is_enabled,
          ttn_application_id: result.data.ttn_application_id,
          provisioning_status: result.data.provisioning_status,
          api_key_last4: result.data.ttn_api_key_last4,
          api_key_updated_at: result.data.ttn_api_key_updated_at,
          last_updated_source: result.data.ttn_last_updated_source,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[manage-ttn-settings] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
