import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TTNSettingsUpdate {
  is_enabled?: boolean;
  ttn_region?: string;
  ttn_stack_base_url?: string;
  ttn_identity_server_url?: string;
  ttn_application_id?: string;
  ttn_application_name?: string;
  ttn_user_id?: string;
  ttn_webhook_id?: string;
  ttn_api_key?: string; // Plain text - will be encrypted before storage
  ttn_webhook_api_key?: string; // Plain text - will be encrypted before storage
}

// Simple XOR-based obfuscation (not true encryption, but protects from casual viewing)
// For production, use Supabase Vault or a proper encryption service
function obfuscateKey(key: string, salt: string): string {
  const result: number[] = [];
  for (let i = 0; i < key.length; i++) {
    result.push(key.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
  }
  return btoa(String.fromCharCode(...result));
}

function deobfuscateKey(encoded: string, salt: string): string {
  try {
    const decoded = atob(encoded);
    const result: number[] = [];
    for (let i = 0; i < decoded.length; i++) {
      result.push(decoded.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
    }
    return String.fromCharCode(...result);
  } catch {
    return "";
  }
}

// Get last 4 characters for display
function getLast4(key: string): string {
  return key.length >= 4 ? key.slice(-4) : key;
}

// Default TTN region URLs
const regionUrls: Record<string, { base: string; is: string }> = {
  NAM1: { base: "https://nam1.cloud.thethings.network", is: "https://eu1.cloud.thethings.network" },
  EU1: { base: "https://eu1.cloud.thethings.network", is: "https://eu1.cloud.thethings.network" },
  AU1: { base: "https://au1.cloud.thethings.network", is: "https://eu1.cloud.thethings.network" },
  AS1: { base: "https://as1.cloud.thethings.network", is: "https://eu1.cloud.thethings.network" },
};

Deno.serve(async (req: Request) => {
  const BUILD_VERSION = "manage-ttn-settings-v2-20251231";
  console.log(`[manage-ttn-settings] Build: ${BUILD_VERSION}`);
  console.log(`[manage-ttn-settings] Method: ${req.method}, URL: ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") || supabaseServiceKey.slice(0, 32);

    // Get authorization header for user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body to get action (default to "get")
    let body: { action?: string; [key: string]: unknown } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine for "get" action
    }
    const action = body.action || "get";
    console.log(`[manage-ttn-settings] Action: ${action}`);

    // Create service client for admin operations (used for JWT verification and admin queries)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Extract the token from the header and verify using admin client
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error("[manage-ttn-settings] Auth verification failed:", userError?.message || "No user");
      return new Response(
        JSON.stringify({ error: "Invalid user session", details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's JWT for RLS-protected queries
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user's profile to find organization
    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(
        JSON.stringify({ error: "User has no organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const organizationId = profile.organization_id;

    // Check if user is admin/owner (RLS will enforce this, but let's be explicit)
    const { data: roleCheck } = await supabaseUser
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .single();

    if (!roleCheck || !["owner", "admin"].includes(roleCheck.role)) {
      return new Response(
        JSON.stringify({ error: "Only admins and owners can manage TTN settings" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET action - Fetch current settings (masked)
    if (action === "get") {
      console.log(`[manage-ttn-settings] GET settings for org: ${organizationId}`);

      // Try to get existing settings
      let { data: settings } = await supabaseUser
        .from("ttn_connections")
        .select("*")
        .eq("organization_id", organizationId)
        .single();

      // If no settings exist, return defaults
      if (!settings) {
        // Also get current global defaults from env
        const globalBaseUrl = Deno.env.get("TTN_API_BASE_URL") || "";
        const globalIsUrl = Deno.env.get("TTN_IS_BASE_URL") || "";
        const globalUserId = Deno.env.get("TTN_USER_ID") || "";
        const hasGlobalApiKey = !!Deno.env.get("TTN_API_KEY");

        return new Response(
          JSON.stringify({
            exists: false,
            is_enabled: false,
            ttn_region: "NAM1",
            ttn_stack_base_url: globalBaseUrl.replace(/\/api\/v3$/, ""),
            ttn_identity_server_url: globalIsUrl.replace(/\/api\/v3$/, ""),
            ttn_user_id: globalUserId,
            ttn_application_id: null,
            ttn_application_name: null,
            ttn_webhook_id: "frostguard",
            has_api_key: hasGlobalApiKey,
            api_key_last4: null,
            api_key_updated_at: null,
            has_webhook_api_key: !!Deno.env.get("TTN_WEBHOOK_API_KEY"),
            webhook_api_key_last4: null,
            last_connection_test_at: null,
            last_connection_test_result: null,
            using_global_defaults: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Return settings with masked keys
      return new Response(
        JSON.stringify({
          exists: true,
          is_enabled: settings.is_enabled,
          ttn_region: settings.ttn_region,
          ttn_stack_base_url: settings.ttn_stack_base_url,
          ttn_identity_server_url: settings.ttn_identity_server_url,
          ttn_user_id: settings.ttn_user_id,
          ttn_application_id: settings.ttn_application_id,
          ttn_application_name: settings.ttn_application_name,
          ttn_webhook_id: settings.ttn_webhook_id,
          has_api_key: !!settings.ttn_api_key_encrypted,
          api_key_last4: settings.ttn_api_key_last4,
          api_key_updated_at: settings.ttn_api_key_updated_at,
          has_webhook_api_key: !!settings.ttn_webhook_api_key_encrypted,
          webhook_api_key_last4: settings.ttn_webhook_api_key_last4,
          last_connection_test_at: settings.last_connection_test_at,
          last_connection_test_result: settings.last_connection_test_result,
          using_global_defaults: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TEST action - Test TTN connection
    if (action === "test") {
      console.log(`[manage-ttn-settings] Testing TTN connection for org: ${organizationId}`);

      // Get settings
      const { data: settings } = await supabaseUser
        .from("ttn_connections")
        .select("*")
        .eq("organization_id", organizationId)
        .single();

      // Determine which credentials to use
      let apiKey: string;
      let baseUrl: string;
      let isUrl: string;
      let userId: string;
      let appId: string | null = null;

      if (settings?.is_enabled && settings.ttn_api_key_encrypted) {
        // Use org-specific settings
        apiKey = deobfuscateKey(settings.ttn_api_key_encrypted, encryptionSalt);
        baseUrl = settings.ttn_stack_base_url || regionUrls[settings.ttn_region || "NAM1"]?.base || "";
        isUrl = settings.ttn_identity_server_url || regionUrls[settings.ttn_region || "NAM1"]?.is || "";
        userId = settings.ttn_user_id || "";
        appId = settings.ttn_application_id;
      } else {
        // Use global defaults
        apiKey = Deno.env.get("TTN_API_KEY") || "";
        baseUrl = Deno.env.get("TTN_API_BASE_URL") || "";
        isUrl = Deno.env.get("TTN_IS_BASE_URL") || "https://eu1.cloud.thethings.network";
        userId = Deno.env.get("TTN_USER_ID") || "";
      }

      if (!apiKey) {
        const testResult = {
          success: false,
          error: "No API key configured",
          tested_at: new Date().toISOString(),
        };

        if (settings) {
          await supabaseAdmin
            .from("ttn_connections")
            .update({
              last_connection_test_at: new Date().toISOString(),
              last_connection_test_result: testResult,
            })
            .eq("id", settings.id);
        }

        return new Response(
          JSON.stringify(testResult),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Normalize URLs
      const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, "").replace(/\/api\/v3$/, "");
      const effectiveIsUrl = normalizeUrl(isUrl);

      // Test: Try to list user's applications
      console.log(`[manage-ttn-settings] Testing TTN API at ${effectiveIsUrl}`);
      
      try {
        const testEndpoint = appId 
          ? `/api/v3/applications/${appId}`
          : `/api/v3/users/${userId}/applications`;
        
        const response = await fetch(`${effectiveIsUrl}${testEndpoint}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        const testResult: Record<string, unknown> = {
          tested_at: new Date().toISOString(),
          endpoint_tested: testEndpoint,
          status_code: response.status,
        };

        if (response.ok) {
          testResult.success = true;
          testResult.message = "Connection successful";
          
          const data = await response.json();
          if (appId) {
            testResult.application_name = data.name || appId;
          } else {
            testResult.applications_count = data.applications?.length || 0;
          }
        } else {
          const errorText = await response.text();
          testResult.success = false;
          
          if (response.status === 401) {
            testResult.error = "Invalid API key";
            testResult.hint = "The API key is invalid or expired. Generate a new one in TTN Console.";
          } else if (response.status === 403) {
            testResult.error = "Insufficient permissions";
            testResult.hint = "The API key lacks required permissions. Ensure it has 'applications:read' rights.";
          } else if (response.status === 404) {
            testResult.error = "Not found";
            testResult.hint = appId 
              ? `Application '${appId}' not found. Check the Application ID.`
              : `User '${userId}' not found. Check the TTN User ID.`;
          } else {
            testResult.error = `TTN API error (${response.status})`;
            testResult.details = errorText.slice(0, 500);
          }
        }

        // Save test result
        if (settings) {
          await supabaseAdmin
            .from("ttn_connections")
            .update({
              last_connection_test_at: new Date().toISOString(),
              last_connection_test_result: testResult,
            })
            .eq("id", settings.id);
        }

        // Log to event_logs
        await supabaseAdmin.from("event_logs").insert({
          organization_id: organizationId,
          event_type: testResult.success ? "ttn.settings.tested" : "ttn.settings.test_failed",
          category: "settings",
          severity: testResult.success ? "info" : "warning",
          title: testResult.success ? "TTN Connection Test Passed" : "TTN Connection Test Failed",
          actor_id: user.id,
          event_data: { result: testResult },
        });

        return new Response(
          JSON.stringify(testResult),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (fetchError) {
        const testResult = {
          success: false,
          error: "Network error",
          details: fetchError instanceof Error ? fetchError.message : "Connection failed",
          hint: "Check if the TTN Stack Base URL is correct and accessible.",
          tested_at: new Date().toISOString(),
        };

        if (settings) {
          await supabaseAdmin
            .from("ttn_connections")
            .update({
              last_connection_test_at: new Date().toISOString(),
              last_connection_test_result: testResult,
            })
            .eq("id", settings.id);
        }

        return new Response(
          JSON.stringify(testResult),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // UPDATE action - Update settings
    if (action === "update") {
      console.log(`[manage-ttn-settings] Updating settings for org: ${organizationId}`);

      const updates: TTNSettingsUpdate = body as TTNSettingsUpdate;
      console.log(`[manage-ttn-settings] Updates:`, { ...updates, ttn_api_key: updates.ttn_api_key ? "[REDACTED]" : undefined });

      // Build update object
      const dbUpdates: Record<string, unknown> = {
        updated_by: user.id,
      };

      // Copy simple fields
      if (updates.is_enabled !== undefined) dbUpdates.is_enabled = updates.is_enabled;
      if (updates.ttn_region !== undefined) dbUpdates.ttn_region = updates.ttn_region;
      if (updates.ttn_stack_base_url !== undefined) dbUpdates.ttn_stack_base_url = updates.ttn_stack_base_url;
      if (updates.ttn_identity_server_url !== undefined) dbUpdates.ttn_identity_server_url = updates.ttn_identity_server_url;
      if (updates.ttn_application_id !== undefined) dbUpdates.ttn_application_id = updates.ttn_application_id;
      if (updates.ttn_application_name !== undefined) dbUpdates.ttn_application_name = updates.ttn_application_name;
      if (updates.ttn_user_id !== undefined) dbUpdates.ttn_user_id = updates.ttn_user_id;
      if (updates.ttn_webhook_id !== undefined) dbUpdates.ttn_webhook_id = updates.ttn_webhook_id;

      // Handle API key encryption
      if (updates.ttn_api_key) {
        dbUpdates.ttn_api_key_encrypted = obfuscateKey(updates.ttn_api_key, encryptionSalt);
        dbUpdates.ttn_api_key_last4 = getLast4(updates.ttn_api_key);
        dbUpdates.ttn_api_key_updated_at = new Date().toISOString();
      }

      // Handle webhook API key encryption
      if (updates.ttn_webhook_api_key) {
        dbUpdates.ttn_webhook_api_key_encrypted = obfuscateKey(updates.ttn_webhook_api_key, encryptionSalt);
        dbUpdates.ttn_webhook_api_key_last4 = getLast4(updates.ttn_webhook_api_key);
      }

      // Check if record exists
      const { data: existing } = await supabaseUser
        .from("ttn_connections")
        .select("id")
        .eq("organization_id", organizationId)
        .single();

      let result;
      if (existing) {
        // Update existing
        result = await supabaseAdmin
          .from("ttn_connections")
          .update(dbUpdates)
          .eq("id", existing.id)
          .select()
          .single();
      } else {
        // Insert new
        result = await supabaseAdmin
          .from("ttn_connections")
          .insert({
            organization_id: organizationId,
            created_by: user.id,
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
      const changedFields = Object.keys(updates).filter(k => k !== "ttn_api_key" && k !== "ttn_webhook_api_key");
      if (updates.ttn_api_key) changedFields.push("api_key");
      if (updates.ttn_webhook_api_key) changedFields.push("webhook_api_key");

      await supabaseAdmin.from("event_logs").insert({
        organization_id: organizationId,
        event_type: updates.is_enabled !== undefined 
          ? (updates.is_enabled ? "ttn.settings.enabled" : "ttn.settings.disabled")
          : "ttn.settings.updated",
        category: "settings",
        severity: "info",
        title: updates.is_enabled !== undefined
          ? (updates.is_enabled ? "TTN Integration Enabled" : "TTN Integration Disabled")
          : "TTN Settings Updated",
        actor_id: user.id,
        event_data: {
          changed_fields: changedFields,
          is_enabled: result.data.is_enabled,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          is_enabled: result.data.is_enabled,
          has_api_key: !!result.data.ttn_api_key_encrypted,
          api_key_last4: result.data.ttn_api_key_last4,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[manage-ttn-settings] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
