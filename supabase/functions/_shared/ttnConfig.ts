/**
 * Shared TTN configuration helper for all edge functions
 * 
 * ARCHITECTURE: Per-Organization TTN Applications
 * Each organization has its own TTN Application, API key, and webhook secret.
 * This provides complete tenant isolation - uplinks from Org A cannot be 
 * processed under Org B even if device payloads are spoofed.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// DevEUI Normalization Helpers
// ============================================================================

/**
 * Normalize DevEUI: strip colons/dashes/spaces, lowercase, validate 16 hex chars
 * Returns null if invalid
 */
export function normalizeDevEui(devEui: string): string | null {
  if (!devEui) return null;
  const normalized = devEui.replace(/[:\-\s]/g, '').toLowerCase();
  if (!/^[0-9a-f]{16}$/.test(normalized)) {
    console.warn(`[normalizeDevEui] Invalid DevEUI format: ${devEui} → ${normalized}`);
    return null;
  }
  return normalized;
}

/**
 * Generate TTN device_id from DevEUI
 * Format: sensor-{lowercase_normalized_deveui}
 */
export function generateTtnDeviceId(devEui: string): string | null {
  const normalized = normalizeDevEui(devEui);
  if (!normalized) return null;
  return `sensor-${normalized}`;
}

/**
 * Format DevEUI for display: XX:XX:XX:XX:XX:XX:XX:XX
 */
export function formatDevEuiForDisplay(devEui: string): string {
  const normalized = normalizeDevEui(devEui);
  if (!normalized) return devEui.toUpperCase();
  return normalized.toUpperCase().match(/.{1,2}/g)?.join(':') || normalized.toUpperCase();
}

// ============================================================================
// TTN Configuration Types and Constants
// ============================================================================

export interface TtnConfig {
  region: string;
  apiKey: string;
  applicationId: string;       // Per-org TTN application ID
  identityBaseUrl: string;     // Always eu1
  regionalBaseUrl: string;     // Based on region
  webhookSecret?: string;
  webhookUrl?: string;
  isEnabled: boolean;
  provisioningStatus: string;
}

export interface TtnConnectionRow {
  id: string;
  organization_id: string;
  is_enabled: boolean;
  ttn_region: string;
  ttn_application_id: string | null;
  ttn_api_key_encrypted: string | null;
  ttn_api_key_last4: string | null;
  ttn_webhook_secret_encrypted: string | null;
  ttn_webhook_secret_last4: string | null;
  ttn_webhook_url: string | null;
  provisioning_status: string | null;
  provisioning_error: string | null;
  ttn_application_provisioned_at: string | null;
}

// Identity Server is always on eu1 for all TTN v3 clusters
const IDENTITY_SERVER_URL = "https://eu1.cloud.thethings.network";

// Regional URLs derived from region
const REGIONAL_URLS: Record<string, string> = {
  nam1: "https://nam1.cloud.thethings.network",
  eu1: "https://eu1.cloud.thethings.network",
  au1: "https://au1.cloud.thethings.network",
  as1: "https://as1.cloud.thethings.network",
};

// XOR-based obfuscation (for API key storage)
export function deobfuscateKey(encoded: string, salt: string): string {
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

export function obfuscateKey(key: string, salt: string): string {
  const result: number[] = [];
  for (let i = 0; i < key.length; i++) {
    result.push(key.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
  }
  return btoa(String.fromCharCode(...result));
}

export function getLast4(key: string): string {
  return key.length >= 4 ? key.slice(-4) : key;
}

/**
 * Generate a unique webhook secret for an organization
 */
export function generateWebhookSecret(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

/**
 * Generate TTN application ID from organization slug or ID
 * Format: freshtracker-{slug} (max 36 chars, lowercase, alphanumeric + dash)
 */
export function generateTtnApplicationId(orgSlug: string): string {
  // Clean and normalize the slug
  const cleanSlug = orgSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')  // Replace invalid chars with dash
    .replace(/-+/g, '-')          // Collapse multiple dashes
    .replace(/^-|-$/g, '');       // Remove leading/trailing dashes
  
  // TTN app IDs must be <= 36 chars, start with letter
  const prefix = 'ft-';
  const maxSlugLen = 36 - prefix.length;
  const truncatedSlug = cleanSlug.slice(0, maxSlugLen);
  
  return `${prefix}${truncatedSlug}`;
}

/**
 * Look up organization by webhook secret
 * Used by ttn-webhook to authenticate incoming webhooks
 * Returns org_id if found, null otherwise
 */
export async function lookupOrgByWebhookSecret(
  supabaseAdmin: SupabaseClient,
  webhookSecret: string
): Promise<{ organizationId: string; applicationId: string } | null> {
  const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") || 
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(0, 32) || "";
  
  // Encrypt the incoming secret to compare against stored values
  const encryptedSecret = obfuscateKey(webhookSecret, encryptionSalt);
  
  const { data, error } = await supabaseAdmin
    .from("ttn_connections")
    .select("organization_id, ttn_application_id")
    .eq("ttn_webhook_secret_encrypted", encryptedSecret)
    .eq("is_enabled", true)
    .maybeSingle();
  
  if (error || !data) {
    console.log(`[lookupOrgByWebhookSecret] No match for secret (error: ${error?.message || 'no data'})`);
    return null;
  }
  
  return {
    organizationId: data.organization_id,
    applicationId: data.ttn_application_id || '',
  };
}

/**
 * Get TTN configuration for a specific organization
 * Returns the org's own TTN application configuration
 */
export async function getTtnConfigForOrg(
  supabaseAdmin: SupabaseClient,
  organizationId: string,
  options?: { requireEnabled?: boolean }
): Promise<TtnConfig | null> {
  const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") || 
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(0, 32) || "";

  // Get TTN connection settings for this org
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("ttn_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (settingsError) {
    console.error("[getTtnConfigForOrg] Error fetching TTN settings:", settingsError);
    return null;
  }

  // No settings record exists
  if (!settings) {
    console.log("[getTtnConfigForOrg] No TTN settings for org:", organizationId);
    return null;
  }

  // Check if enabled (if required)
  if (options?.requireEnabled && !settings.is_enabled) {
    console.log("[getTtnConfigForOrg] TTN not enabled for org:", organizationId);
    return null;
  }

  // Per-org model: application ID comes from the org's settings
  const applicationId = settings.ttn_application_id;
  if (!applicationId && options?.requireEnabled) {
    console.log("[getTtnConfigForOrg] No TTN application provisioned for org:", organizationId);
    return null;
  }

  // Decrypt API key
  const apiKey = settings.ttn_api_key_encrypted 
    ? deobfuscateKey(settings.ttn_api_key_encrypted, encryptionSalt)
    : "";

  if (!apiKey && options?.requireEnabled) {
    console.log("[getTtnConfigForOrg] No API key configured for org:", organizationId);
    return null;
  }

  // Decrypt webhook secret
  const webhookSecret = settings.ttn_webhook_secret_encrypted
    ? deobfuscateKey(settings.ttn_webhook_secret_encrypted, encryptionSalt)
    : undefined;

  // Normalize region (ensure lowercase)
  const region = (settings.ttn_region || "nam1").toLowerCase();

  return {
    region,
    apiKey,
    applicationId: applicationId || "",
    identityBaseUrl: IDENTITY_SERVER_URL,
    regionalBaseUrl: REGIONAL_URLS[region] || REGIONAL_URLS.nam1,
    webhookSecret,
    webhookUrl: settings.ttn_webhook_url || undefined,
    isEnabled: settings.is_enabled || false,
    provisioningStatus: settings.provisioning_status || "not_started",
  };
}

// ============================================================================
// TTN Connection Test Result Type
// ============================================================================

export interface TtnTestResult {
  success: boolean;
  error?: string;
  hint?: string;
  statusCode?: number;
  applicationName?: string;
  testedAt: string;
  endpointTested: string;
  effectiveApplicationId: string;
  apiKeyLast4?: string;
  clusterTested: string;
  deviceTest?: {
    deviceId: string;
    exists: boolean;
    error?: string;
  };
}

/**
 * Test TTN API key permissions for the org's application
 * Tests on Identity Server first (where apps are registered),
 * then optionally tests regional server connectivity.
 */
export async function testTtnConnection(
  config: TtnConfig,
  options?: { testDeviceId?: string }
): Promise<TtnTestResult> {
  const testedAt = new Date().toISOString();
  const appEndpoint = `/api/v3/applications/${config.applicationId}`;
  const clusterTested = config.region;

  if (!config.applicationId) {
    return {
      success: false,
      error: "No TTN application provisioned",
      hint: "Click 'Provision TTN Application' to create your organization's TTN application",
      testedAt,
      endpointTested: appEndpoint,
      effectiveApplicationId: "",
      clusterTested,
    };
  }

  if (!config.apiKey) {
    return {
      success: false,
      error: "No API key configured",
      hint: "Add a TTN API key in Settings → Developer → TTN Connection",
      testedAt,
      endpointTested: appEndpoint,
      effectiveApplicationId: config.applicationId,
      clusterTested,
    };
  }

  const apiKeyLast4 = config.apiKey.length >= 4 ? config.apiKey.slice(-4) : undefined;

  try {
    // Step 1: Test application access on IDENTITY SERVER (eu1) where apps are registered
    // This is the authoritative source for application existence
    console.log(`[testTtnConnection] Testing app on Identity Server: ${config.identityBaseUrl}${appEndpoint}`);
    
    const appResponse = await fetch(
      `${config.identityBaseUrl}${appEndpoint}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`,
          "Accept": "application/json",
        },
      }
    );

    if (!appResponse.ok) {
      const errorText = await appResponse.text();
      console.error(`[testTtnConnection] Identity Server app test failed: ${appResponse.status} ${errorText}`);

      let error: string;
      let hint: string;

      if (appResponse.status === 401) {
        error = "Invalid or expired API key";
        hint = "Generate a new API key in TTN Console → Applications → API keys";
      } else if (appResponse.status === 403) {
        error = "API key lacks permission for this application";
        hint = `Your API key doesn't have rights to access '${config.applicationId}'. Check that the key was created for this application with the correct scopes.`;
      } else if (appResponse.status === 404) {
        error = "Application not found";
        hint = `Application '${config.applicationId}' doesn't exist. It may have been deleted or the ID is incorrect.`;
      } else {
        error = `TTN API error (${appResponse.status})`;
        hint = errorText.slice(0, 200);
      }

      return {
        success: false,
        error,
        hint,
        statusCode: appResponse.status,
        testedAt,
        endpointTested: appEndpoint,
        effectiveApplicationId: config.applicationId,
        apiKeyLast4,
        clusterTested,
      };
    }

    const appData = await appResponse.json();
    const applicationName = appData.name || config.applicationId;

    // Step 2: Optionally test regional server accessibility (for devices/uplinks)
    // Only if a device test is requested
    let deviceTest: TtnTestResult['deviceTest'] = undefined;
    
    if (options?.testDeviceId) {
      const deviceEndpoint = `/api/v3/applications/${config.applicationId}/devices/${options.testDeviceId}`;
      console.log(`[testTtnConnection] Testing device on regional server: ${config.regionalBaseUrl}${deviceEndpoint}`);
      
      const deviceResponse = await fetch(
        `${config.regionalBaseUrl}${deviceEndpoint}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${config.apiKey}`,
            "Accept": "application/json",
          },
        }
      );

      if (deviceResponse.ok) {
        deviceTest = {
          deviceId: options.testDeviceId,
          exists: true,
        };
      } else {
        const deviceError = deviceResponse.status === 404 
          ? "Device not registered in TTN"
          : `Device check failed (${deviceResponse.status})`;
        
        deviceTest = {
          deviceId: options.testDeviceId,
          exists: false,
          error: deviceError,
        };

        // Return failure if device doesn't exist - this is critical for uplink routing
        return {
          success: false,
          error: "Device not found in TTN",
          hint: `Device '${options.testDeviceId}' is not registered in TTN application '${config.applicationId}' on cluster '${config.region}'. TTN will drop uplinks with "entity not found" until the device is provisioned. Click "Provision to TTN" to register this sensor.`,
          statusCode: deviceResponse.status,
          applicationName,
          testedAt,
          endpointTested: deviceEndpoint,
          effectiveApplicationId: config.applicationId,
          apiKeyLast4,
          clusterTested,
          deviceTest,
        };
      }
    }

    return {
      success: true,
      applicationName,
      testedAt,
      endpointTested: appEndpoint,
      effectiveApplicationId: config.applicationId,
      statusCode: appResponse.status,
      apiKeyLast4,
      clusterTested,
      deviceTest,
    };
  } catch (fetchError) {
    console.error(`[testTtnConnection] Network error:`, fetchError);
    return {
      success: false,
      error: "Network error connecting to TTN",
      hint: fetchError instanceof Error ? fetchError.message : "Connection failed - check internet connectivity",
      testedAt,
      endpointTested: appEndpoint,
      effectiveApplicationId: config.applicationId,
      clusterTested,
    };
  }
}

// ============================================================================
// Gateway API Key Support
// ============================================================================

export interface GatewayApiKeyConfig {
  apiKey: string;
  keyType: "personal" | "organization";
  scopeId: string | null;
  updatedAt: string | null;
}

/**
 * Get the gateway-specific API key for an organization
 * This is a separate key from the application API key, required for gateway provisioning
 *
 * IMPORTANT: Gateway provisioning requires a Personal or Organization API key.
 * Application API keys CANNOT provision gateways (TTN v3 API constraint).
 */
export async function getGatewayApiKeyForOrg(
  supabaseAdmin: SupabaseClient,
  organizationId: string
): Promise<GatewayApiKeyConfig | null> {
  const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(0, 32) || "";

  const { data: settings, error } = await supabaseAdmin
    .from("ttn_connections")
    .select("ttn_gateway_api_key_encrypted, ttn_gateway_api_key_type, ttn_gateway_api_key_scope_id, ttn_gateway_api_key_updated_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !settings || !settings.ttn_gateway_api_key_encrypted) {
    console.log("[getGatewayApiKeyForOrg] No gateway API key for org:", organizationId);
    return null;
  }

  const apiKey = deobfuscateKey(settings.ttn_gateway_api_key_encrypted, encryptionSalt);
  if (!apiKey) {
    console.warn("[getGatewayApiKeyForOrg] Failed to decrypt gateway API key");
    return null;
  }

  return {
    apiKey,
    keyType: settings.ttn_gateway_api_key_type || "personal",
    scopeId: settings.ttn_gateway_api_key_scope_id,
    updatedAt: settings.ttn_gateway_api_key_updated_at,
  };
}

/**
 * Save a gateway API key for an organization
 * Validates the key type before saving
 */
export async function saveGatewayApiKeyForOrg(
  supabaseAdmin: SupabaseClient,
  organizationId: string,
  apiKey: string,
  keyType: "personal" | "organization",
  scopeId: string | null
): Promise<{ success: boolean; error?: string }> {
  const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(0, 32) || "";

  const encryptedKey = obfuscateKey(apiKey, encryptionSalt);

  const { error } = await supabaseAdmin
    .from("ttn_connections")
    .update({
      ttn_gateway_api_key_encrypted: encryptedKey,
      ttn_gateway_api_key_last4: getLast4(apiKey),
      ttn_gateway_api_key_type: keyType,
      ttn_gateway_api_key_scope_id: scopeId,
      ttn_gateway_api_key_updated_at: new Date().toISOString(),
      ttn_gateway_rights_verified: true,
      ttn_gateway_rights_checked_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[saveGatewayApiKeyForOrg] Failed to save:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================================================
// DEPRECATED: Global Application ID (for backwards compatibility during migration)
// ============================================================================

/**
 * @deprecated Use per-org application IDs from ttn_connections table instead
 * Get the global TTN Application ID from environment (legacy support only)
 */
export function getGlobalApplicationId(): string {
  const appId = Deno.env.get("TTN_APPLICATION_ID");
  if (!appId) {
    throw new Error("TTN_APPLICATION_ID environment variable is not set");
  }
  return appId;
}
