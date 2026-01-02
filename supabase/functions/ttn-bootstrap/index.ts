/**
 * TTN Bootstrap Edge Function
 *
 * Automates TTN webhook setup when a user saves their API key:
 * 1. Validates API key permissions (applications:read, webhooks:read/write, etc.)
 * 2. Creates or updates the webhook configuration in TTN
 * 3. Stores webhook secret and configuration in FrostGuard
 *
 * This function is designed for users who:
 * - Already have a TTN application (manually created or via ttn-provision-org)
 * - Want to configure their own API key with proper permissions
 *
 * Security:
 * - Requires user authentication (JWT)
 * - Validates org membership (admin/owner)
 * - Never returns full API keys or secrets to client
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateWebhookSecret,
  obfuscateKey,
  getLast4,
} from "../_shared/ttnConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// TTN API endpoints
const IDENTITY_SERVER_URL = "https://eu1.cloud.thethings.network";
const REGIONAL_URLS: Record<string, string> = {
  nam1: "https://nam1.cloud.thethings.network",
  eu1: "https://eu1.cloud.thethings.network",
  au1: "https://au1.cloud.thethings.network",
  as1: "https://as1.cloud.thethings.network",
};

// Required rights for FrostGuard TTN integration
const REQUIRED_RIGHTS = {
  // Minimum required permissions
  core: [
    "RIGHT_APPLICATION_INFO",           // Read application info
    "RIGHT_APPLICATION_TRAFFIC_READ",   // Read uplink messages
  ],
  // Required for webhook management
  webhook: [
    "RIGHT_APPLICATION_SETTINGS_BASIC", // Manage webhooks
  ],
  // Required for device management (optional but recommended)
  devices: [
    "RIGHT_APPLICATION_DEVICES_READ",
    "RIGHT_APPLICATION_DEVICES_WRITE",
  ],
  // Required for downlinks (optional)
  downlink: [
    "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE",
  ],
};

// Human-readable permission names for UI
const PERMISSION_LABELS: Record<string, string> = {
  "RIGHT_APPLICATION_INFO": "Read application info",
  "RIGHT_APPLICATION_TRAFFIC_READ": "Read uplink messages",
  "RIGHT_APPLICATION_SETTINGS_BASIC": "Manage application settings (webhooks)",
  "RIGHT_APPLICATION_DEVICES_READ": "Read devices",
  "RIGHT_APPLICATION_DEVICES_WRITE": "Write devices",
  "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE": "Send downlink messages",
};

interface BootstrapRequest {
  action: "validate" | "validate_only" | "configure" | "save_and_configure";
  organization_id: string;
  cluster: string;
  application_id: string;
  api_key?: string; // Only required for new/changed key
}

interface PermissionCheckResult {
  valid: boolean;
  rights: string[];
  missing_core: string[];
  missing_webhook: string[];
  missing_devices: string[];
  missing_downlink: string[];
  can_configure_webhook: boolean;
  can_manage_devices: boolean;
  can_send_downlinks: boolean;
}

interface WebhookConfig {
  webhook_id: string;
  base_url: string;
  format: string;
  events_enabled: string[];
  secret_configured: boolean;
}

interface BootstrapResult {
  ok: boolean;
  request_id: string;
  action: string;

  // Permission validation results
  permissions?: PermissionCheckResult;

  // Webhook configuration results
  webhook?: WebhookConfig;
  webhook_action?: "created" | "updated" | "unchanged";

  // Error information
  error?: {
    code: string;
    message: string;
    hint: string;
    missing_permissions?: string[];
  };

  // Stored configuration metadata
  config?: {
    api_key_last4: string;
    webhook_secret_last4: string;
    webhook_url: string;
    application_id: string;
    cluster: string;
    updated_at: string;
  };
}

/**
 * Validate API key by fetching the application and checking rights
 */
async function validateApiKeyPermissions(
  apiKey: string,
  applicationId: string,
  requestId: string
): Promise<{ success: boolean; rights?: string[]; error?: string; hint?: string; statusCode?: number }> {
  console.log(`[ttn-bootstrap] [${requestId}] Validating API key for app: ${applicationId}`);

  try {
    // Fetch application info - this tells us if the key has basic access
    const appResponse = await fetch(
      `${IDENTITY_SERVER_URL}/api/v3/applications/${applicationId}?field_mask=ids,name,attributes`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
        },
      }
    );

    if (!appResponse.ok) {
      const errorText = await appResponse.text();
      console.error(`[ttn-bootstrap] [${requestId}] App fetch failed: ${appResponse.status} ${errorText}`);

      // Parse TTN error response for better error messages
      let ttnError: { code?: number; message?: string; name?: string } = {};
      try {
        ttnError = JSON.parse(errorText);
      } catch {
        // Not JSON, use raw text
      }

      // Handle 400 - often returned for invalid/malformed tokens
      if (appResponse.status === 400) {
        // TTN error code 3 = invalid token
        if (ttnError.code === 3 || ttnError.message?.includes("invalid token")) {
          return {
            success: false,
            error: "Invalid API key format",
            hint: "Your API key appears to be malformed or expired. TTN API keys start with 'NNSXS.' and are typically 80+ characters. Copy the full key from TTN Console → Applications → API keys.",
            statusCode: 400,
          };
        }
        return {
          success: false,
          error: "Invalid request to TTN",
          hint: ttnError.message || errorText.slice(0, 200),
          statusCode: 400,
        };
      }

      if (appResponse.status === 401) {
        return {
          success: false,
          error: "Invalid or expired API key",
          hint: "Generate a new API key in TTN Console → Applications → API keys",
          statusCode: 401,
        };
      }

      if (appResponse.status === 403) {
        return {
          success: false,
          error: "API key lacks permission to access this application",
          hint: `Make sure the API key was created for application '${applicationId}' with appropriate scopes`,
          statusCode: 403,
        };
      }

      if (appResponse.status === 404) {
        return {
          success: false,
          error: "Application not found",
          hint: `Application '${applicationId}' doesn't exist in TTN. Check the Application ID.`,
          statusCode: 404,
        };
      }

      return {
        success: false,
        error: `TTN API error (${appResponse.status})`,
        hint: ttnError.message || errorText.slice(0, 200),
        statusCode: appResponse.status,
      };
    }

    // Try to get API key info with rights
    // TTN provides rights information in the API key info endpoint
    const keyInfoResponse = await fetch(
      `${IDENTITY_SERVER_URL}/api/v3/applications/${applicationId}/api-keys`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
        },
      }
    );

    let detectedRights: string[] = [];

    if (keyInfoResponse.ok) {
      // We can read API keys, which implies we have some admin rights
      detectedRights.push("RIGHT_APPLICATION_SETTINGS_BASIC");
      detectedRights.push("RIGHT_APPLICATION_INFO");
    }

    // Test device read access
    const devicesResponse = await fetch(
      `${IDENTITY_SERVER_URL}/api/v3/applications/${applicationId}/devices?limit=1`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
        },
      }
    );

    if (devicesResponse.ok) {
      detectedRights.push("RIGHT_APPLICATION_DEVICES_READ");
    }

    // Since we successfully read the application, we have at least basic info rights
    if (!detectedRights.includes("RIGHT_APPLICATION_INFO")) {
      detectedRights.push("RIGHT_APPLICATION_INFO");
    }

    // The key works - we'll assume it has the rights it was created with
    // In practice, we'll detect missing rights when we try to create/update webhook
    console.log(`[ttn-bootstrap] [${requestId}] Detected rights: ${detectedRights.join(", ")}`);

    return { success: true, rights: detectedRights };
  } catch (fetchError) {
    console.error(`[ttn-bootstrap] [${requestId}] Network error:`, fetchError);
    return {
      success: false,
      error: "Network error connecting to TTN",
      hint: fetchError instanceof Error ? fetchError.message : "Check internet connectivity",
    };
  }
}

/**
 * Check permissions and return detailed results
 */
function analyzePermissions(rights: string[]): PermissionCheckResult {
  const missing_core = REQUIRED_RIGHTS.core.filter(r => !rights.includes(r));
  const missing_webhook = REQUIRED_RIGHTS.webhook.filter(r => !rights.includes(r));
  const missing_devices = REQUIRED_RIGHTS.devices.filter(r => !rights.includes(r));
  const missing_downlink = REQUIRED_RIGHTS.downlink.filter(r => !rights.includes(r));

  return {
    valid: missing_core.length === 0,
    rights,
    missing_core,
    missing_webhook,
    missing_devices,
    missing_downlink,
    can_configure_webhook: missing_webhook.length === 0,
    can_manage_devices: missing_devices.length === 0,
    can_send_downlinks: missing_downlink.length === 0,
  };
}

/**
 * Create or update webhook in TTN
 */
async function upsertWebhook(
  apiKey: string,
  applicationId: string,
  cluster: string,
  webhookSecret: string,
  webhookUrl: string,
  requestId: string
): Promise<{ success: boolean; action?: "created" | "updated"; error?: string; hint?: string }> {
  const webhookId = "freshtracker";
  const regionalUrl = REGIONAL_URLS[cluster] || REGIONAL_URLS.nam1;

  console.log(`[ttn-bootstrap] [${requestId}] Upserting webhook: ${webhookId} on ${regionalUrl}`);

  const webhookConfig = {
    webhook: {
      ids: {
        webhook_id: webhookId,
        application_ids: { application_id: applicationId },
      },
      base_url: webhookUrl,
      format: "json",
      headers: {
        "X-Webhook-Secret": webhookSecret,
      },
      uplink_message: {},
      join_accept: {},
    },
  };

  // First, try to check if webhook exists
  const getResponse = await fetch(
    `${regionalUrl}/api/v3/as/webhooks/${applicationId}/${webhookId}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    }
  );

  if (getResponse.ok) {
    // Webhook exists, update it
    console.log(`[ttn-bootstrap] [${requestId}] Webhook exists, updating...`);

    const updateResponse = await fetch(
      `${regionalUrl}/api/v3/as/webhooks/${applicationId}/${webhookId}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...webhookConfig,
          field_mask: {
            paths: ["headers", "base_url", "format", "uplink_message", "join_accept"],
          },
        }),
      }
    );

    if (updateResponse.ok) {
      return { success: true, action: "updated" };
    }

    const errorText = await updateResponse.text();
    console.error(`[ttn-bootstrap] [${requestId}] Webhook update failed: ${updateResponse.status} ${errorText}`);

    if (updateResponse.status === 403) {
      return {
        success: false,
        error: "API key lacks permission to update webhooks",
        hint: "Your API key needs 'Write application settings' or 'Manage webhooks' permission. Create a new key with this scope in TTN Console.",
      };
    }

    return {
      success: false,
      error: `Failed to update webhook (${updateResponse.status})`,
      hint: errorText.slice(0, 200),
    };
  }

  if (getResponse.status === 404) {
    // Webhook doesn't exist, create it
    console.log(`[ttn-bootstrap] [${requestId}] Webhook doesn't exist, creating...`);

    const createResponse = await fetch(
      `${regionalUrl}/api/v3/as/webhooks/${applicationId}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(webhookConfig),
      }
    );

    if (createResponse.ok) {
      return { success: true, action: "created" };
    }

    const errorText = await createResponse.text();
    console.error(`[ttn-bootstrap] [${requestId}] Webhook creation failed: ${createResponse.status} ${errorText}`);

    if (createResponse.status === 403) {
      return {
        success: false,
        error: "API key lacks permission to create webhooks",
        hint: "Your API key needs 'Write application settings' or 'Manage webhooks' permission. Create a new key with this scope in TTN Console.",
      };
    }

    return {
      success: false,
      error: `Failed to create webhook (${createResponse.status})`,
      hint: errorText.slice(0, 200),
    };
  }

  // Unexpected response from GET
  const errorText = await getResponse.text();
  console.error(`[ttn-bootstrap] [${requestId}] Unexpected webhook check response: ${getResponse.status}`);

  if (getResponse.status === 403) {
    return {
      success: false,
      error: "API key lacks permission to read webhooks",
      hint: "Your API key needs 'Read application settings' permission to check existing webhooks.",
    };
  }

  return {
    success: false,
    error: `Failed to check existing webhook (${getResponse.status})`,
    hint: errorText.slice(0, 200),
  };
}

serve(async (req) => {
  const BUILD_VERSION = "ttn-bootstrap-v1.0-20260102";
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[ttn-bootstrap] [${requestId}] Build: ${BUILD_VERSION}`);
  console.log(`[ttn-bootstrap] [${requestId}] Method: ${req.method}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check with contract metadata
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "ok",
        function: "ttn-bootstrap",
        version: BUILD_VERSION,
        timestamp: new Date().toISOString(),
        contract: {
          required_fields: [
            "organization_id",
            "cluster",
            "application_id",
            "action"
          ],
          optional_fields: [
            "api_key",
            "owner_scope",
            "credential_type"
          ],
          supported_actions: [
            "validate",
            "validate_only",
            "configure",
            "save_and_configure"
          ],
          supported_clusters: Object.keys(REGIONAL_URLS),
        },
        capabilities: {
          validate_only: true,
          webhook_management: true,
          permission_detection: true,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") || supabaseServiceKey.slice(0, 32);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "Missing authorization header", hint: "Log in again" },
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "Invalid user session", hint: "Log in again" },
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ttn-bootstrap] [${requestId}] User: ${user.id}`);

    // Parse request body
    const body: BootstrapRequest = await req.json();
    const { action, organization_id, cluster, application_id, api_key } = body;

    console.log(`[ttn-bootstrap] [${requestId}] Action: ${action}, Org: ${organization_id}, App: ${application_id}, Cluster: ${cluster}`);

    // Validate required fields
    if (!organization_id || !cluster || !application_id) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Missing required fields",
            hint: "Provide organization_id, cluster, and application_id"
          },
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is admin/owner of the org
    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (!roleCheck || !["owner", "admin"].includes(roleCheck.role)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: "FORBIDDEN", message: "Only admins and owners can configure TTN", hint: "Contact your org admin" },
          request_id: requestId,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing TTN settings
    const { data: existingSettings } = await supabase
      .from("ttn_connections")
      .select("*")
      .eq("organization_id", organization_id)
      .maybeSingle();

    // Determine which API key to use
    let effectiveApiKey = api_key;

    if (!effectiveApiKey && existingSettings?.ttn_api_key_encrypted) {
      // Decrypt existing key
      const { deobfuscateKey } = await import("../_shared/ttnConfig.ts");
      effectiveApiKey = deobfuscateKey(existingSettings.ttn_api_key_encrypted, encryptionSalt);
    }

    if (!effectiveApiKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "NO_API_KEY",
            message: "No API key provided or stored",
            hint: "Enter your TTN API key"
          },
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // ACTION: VALIDATE - Check API key permissions only
    // ========================================
    if (action === "validate") {
      const validation = await validateApiKeyPermissions(effectiveApiKey, application_id, requestId);

      if (!validation.success) {
        return new Response(
          JSON.stringify({
            ok: false,
            action: "validate",
            error: {
              code: "TTN_VALIDATION_FAILED",
              message: validation.error || "Validation failed",
              hint: validation.hint || "",
            },
            request_id: requestId,
          } as BootstrapResult),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const permissions = analyzePermissions(validation.rights || []);

      return new Response(
        JSON.stringify({
          ok: true,
          action: "validate",
          permissions,
          request_id: requestId,
        } as BootstrapResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // ACTION: VALIDATE_ONLY - Dry-run validation without persisting state
    // ========================================
    if (action === "validate_only") {
      console.log(`[ttn-bootstrap] [${requestId}] Validate-only mode - no state changes will be made`);
      
      // Build validation errors for required fields
      const validationErrors: string[] = [];
      if (!organization_id) validationErrors.push("organization_id is required");
      if (!cluster) validationErrors.push("cluster is required");
      if (!application_id) validationErrors.push("application_id is required");
      
      if (!REGIONAL_URLS[cluster]) {
        validationErrors.push(`Invalid cluster: ${cluster}. Valid: ${Object.keys(REGIONAL_URLS).join(", ")}`);
      }
      
      if (validationErrors.length > 0) {
        return new Response(
          JSON.stringify({
            ok: false,
            valid: false,
            action: "validate_only",
            validation_errors: validationErrors,
            request_id: requestId,
            dry_run: true,
            state_modified: false,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // If api_key provided, test permissions against TTN
      let permissionCheck = null;
      const warnings: string[] = [];
      
      if (effectiveApiKey) {
        const keyValidation = await validateApiKeyPermissions(effectiveApiKey, application_id, requestId);
        
        if (!keyValidation.success) {
          return new Response(
            JSON.stringify({
              ok: false,
              valid: false,
              action: "validate_only",
              error: { 
                code: "TTN_KEY_INVALID",
                message: keyValidation.error || "API key validation failed",
                hint: keyValidation.hint,
              },
              request_id: requestId,
              dry_run: true,
              state_modified: false,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Analyze permissions
        permissionCheck = analyzePermissions(keyValidation.rights || []);
        
        if (!permissionCheck.can_configure_webhook) {
          warnings.push("API key may lack webhook management permissions");
        }
        if (!permissionCheck.can_manage_devices) {
          warnings.push("API key cannot manage devices - you won't be able to provision sensors");
        }
      } else {
        warnings.push("No API key provided - cannot verify TTN permissions");
      }
      
      // Return validation result (no state changes made)
      console.log(`[ttn-bootstrap] [${requestId}] Validate-only completed - valid: true, warnings: ${warnings.length}`);
      
      return new Response(
        JSON.stringify({
          ok: true,
          valid: true,
          action: "validate_only",
          request_id: requestId,
          resolved: {
            cluster,
            application_id,
            organization_id,
          },
          permissions: permissionCheck,
          warnings,
          dry_run: true,
          state_modified: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // ACTION: CONFIGURE - Configure webhook only (no settings save)
    // ========================================
    if (action === "configure") {
      // Validate first
      const validation = await validateApiKeyPermissions(effectiveApiKey, application_id, requestId);

      if (!validation.success) {
        return new Response(
          JSON.stringify({
            ok: false,
            action: "configure",
            error: {
              code: "TTN_VALIDATION_FAILED",
              message: validation.error || "Validation failed",
              hint: validation.hint || "",
            },
            request_id: requestId,
          } as BootstrapResult),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate webhook URL
      const webhookUrl = `${supabaseUrl}/functions/v1/ttn-webhook`;

      // Generate or reuse webhook secret
      let webhookSecret: string;
      if (existingSettings?.ttn_webhook_secret_encrypted) {
        const { deobfuscateKey } = await import("../_shared/ttnConfig.ts");
        webhookSecret = deobfuscateKey(existingSettings.ttn_webhook_secret_encrypted, encryptionSalt);
      } else {
        webhookSecret = generateWebhookSecret();
      }

      // Configure webhook in TTN
      const webhookResult = await upsertWebhook(
        effectiveApiKey,
        application_id,
        cluster,
        webhookSecret,
        webhookUrl,
        requestId
      );

      if (!webhookResult.success) {
        return new Response(
          JSON.stringify({
            ok: false,
            action: "configure",
            error: {
              code: "WEBHOOK_SETUP_FAILED",
              message: webhookResult.error || "Webhook setup failed",
              hint: webhookResult.hint || "",
            },
            request_id: requestId,
          } as BootstrapResult),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const permissions = analyzePermissions(validation.rights || []);

      return new Response(
        JSON.stringify({
          ok: true,
          action: "configure",
          permissions,
          webhook: {
            webhook_id: "freshtracker",
            base_url: webhookUrl,
            format: "json",
            events_enabled: ["uplink_message", "join_accept"],
            secret_configured: true,
          },
          webhook_action: webhookResult.action,
          request_id: requestId,
        } as BootstrapResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // ACTION: SAVE_AND_CONFIGURE - Full workflow
    // ========================================
    if (action === "save_and_configure") {
      // Step 1: Validate API key permissions
      console.log(`[ttn-bootstrap] [${requestId}] Step 1: Validating API key permissions`);
      const validation = await validateApiKeyPermissions(effectiveApiKey, application_id, requestId);

      if (!validation.success) {
        return new Response(
          JSON.stringify({
            ok: false,
            action: "save_and_configure",
            error: {
              code: "TTN_PERMISSION_MISSING",
              message: validation.error || "API key validation failed",
              hint: validation.hint || "Check your API key permissions",
            },
            request_id: requestId,
          } as BootstrapResult),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const permissions = analyzePermissions(validation.rights || []);

      // Check if we have minimum required permissions
      if (!permissions.valid) {
        const missingLabels = permissions.missing_core.map(r => PERMISSION_LABELS[r] || r);
        return new Response(
          JSON.stringify({
            ok: false,
            action: "save_and_configure",
            permissions,
            error: {
              code: "TTN_PERMISSION_MISSING",
              message: "API key is missing required permissions",
              hint: `Missing: ${missingLabels.join(", ")}. Create a new API key with these scopes.`,
              missing_permissions: permissions.missing_core,
            },
            request_id: requestId,
          } as BootstrapResult),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 2: Generate webhook URL and secret
      console.log(`[ttn-bootstrap] [${requestId}] Step 2: Preparing webhook configuration`);
      const webhookUrl = `${supabaseUrl}/functions/v1/ttn-webhook`;

      // Generate new webhook secret if this is a new key or no secret exists
      let webhookSecret: string;
      const isNewKey = api_key && (!existingSettings?.ttn_api_key_last4 || getLast4(api_key) !== existingSettings.ttn_api_key_last4);

      if (isNewKey || !existingSettings?.ttn_webhook_secret_encrypted) {
        webhookSecret = generateWebhookSecret();
        console.log(`[ttn-bootstrap] [${requestId}] Generated new webhook secret`);
      } else {
        const { deobfuscateKey } = await import("../_shared/ttnConfig.ts");
        webhookSecret = deobfuscateKey(existingSettings.ttn_webhook_secret_encrypted, encryptionSalt);
        console.log(`[ttn-bootstrap] [${requestId}] Reusing existing webhook secret`);
      }

      // Step 3: Configure webhook in TTN
      console.log(`[ttn-bootstrap] [${requestId}] Step 3: Configuring webhook in TTN`);
      const webhookResult = await upsertWebhook(
        effectiveApiKey,
        application_id,
        cluster,
        webhookSecret,
        webhookUrl,
        requestId
      );

      if (!webhookResult.success) {
        return new Response(
          JSON.stringify({
            ok: false,
            action: "save_and_configure",
            permissions,
            error: {
              code: "WEBHOOK_SETUP_FAILED",
              message: webhookResult.error || "Failed to configure webhook in TTN",
              hint: webhookResult.hint || "Check your API key has webhook write permissions",
            },
            request_id: requestId,
          } as BootstrapResult),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 4: Save settings to database
      console.log(`[ttn-bootstrap] [${requestId}] Step 4: Saving configuration to database`);

      const encryptedApiKey = obfuscateKey(effectiveApiKey, encryptionSalt);
      const encryptedWebhookSecret = obfuscateKey(webhookSecret, encryptionSalt);
      const now = new Date().toISOString();

      const settingsData = {
        organization_id: organization_id,
        is_enabled: true,
        ttn_region: cluster.toLowerCase(),
        ttn_application_id: application_id,
        ttn_api_key_encrypted: encryptedApiKey,
        ttn_api_key_last4: getLast4(effectiveApiKey),
        ttn_api_key_updated_at: now,
        ttn_webhook_secret_encrypted: encryptedWebhookSecret,
        ttn_webhook_secret_last4: getLast4(webhookSecret),
        ttn_webhook_url: webhookUrl,
        ttn_webhook_id: "freshtracker",
        ttn_webhook_events: ["uplink_message", "join_accept"],
        provisioning_status: "completed",
        provisioning_error: null,
        ttn_last_updated_source: "frostguard",
        updated_by: user.id,
        updated_at: now,
      };

      let upsertResult;
      if (existingSettings) {
        upsertResult = await supabase
          .from("ttn_connections")
          .update(settingsData)
          .eq("id", existingSettings.id)
          .select()
          .single();
      } else {
        upsertResult = await supabase
          .from("ttn_connections")
          .insert({
            ...settingsData,
            created_by: user.id,
          })
          .select()
          .single();
      }

      if (upsertResult.error) {
        console.error(`[ttn-bootstrap] [${requestId}] Database error:`, upsertResult.error);
        return new Response(
          JSON.stringify({
            ok: false,
            action: "save_and_configure",
            permissions,
            webhook: {
              webhook_id: "freshtracker",
              base_url: webhookUrl,
              format: "json",
              events_enabled: ["uplink_message", "join_accept"],
              secret_configured: true,
            },
            webhook_action: webhookResult.action,
            error: {
              code: "DATABASE_ERROR",
              message: "Webhook configured but failed to save settings",
              hint: "The webhook is set up in TTN but we couldn't save locally. Try again.",
            },
            request_id: requestId,
          } as BootstrapResult),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log success event
      await supabase.from("event_logs").insert({
        organization_id: organization_id,
        event_type: "ttn.bootstrap.completed",
        category: "settings",
        severity: "info",
        title: "TTN Webhook Configured",
        actor_id: user.id,
        event_data: {
          application_id,
          cluster,
          webhook_action: webhookResult.action,
          api_key_last4: getLast4(effectiveApiKey),
          request_id: requestId,
        },
      });

      console.log(`[ttn-bootstrap] [${requestId}] Bootstrap completed successfully`);

      return new Response(
        JSON.stringify({
          ok: true,
          action: "save_and_configure",
          permissions,
          webhook: {
            webhook_id: "freshtracker",
            base_url: webhookUrl,
            format: "json",
            events_enabled: ["uplink_message", "join_accept"],
            secret_configured: true,
          },
          webhook_action: webhookResult.action,
          config: {
            api_key_last4: getLast4(effectiveApiKey),
            webhook_secret_last4: getLast4(webhookSecret),
            webhook_url: webhookUrl,
            application_id,
            cluster,
            updated_at: now,
          },
          request_id: requestId,
        } as BootstrapResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: "UNKNOWN_ACTION", message: `Unknown action: ${action}`, hint: "Use 'validate', 'configure', or 'save_and_configure'" },
        request_id: requestId,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[ttn-bootstrap] [${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Internal error",
          hint: "Check server logs"
        },
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
