/**
 * Shared TTN configuration helper for all edge functions
 * Uses a single global TTN_APPLICATION_ID for the entire platform
 * Multi-tenancy is enforced in Supabase, not by separate TTN applications
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
  applicationId: string;       // Always from TTN_APPLICATION_ID env var
  identityBaseUrl: string;     // Always eu1
  regionalBaseUrl: string;     // Based on region
  webhookSecret?: string;
  isEnabled: boolean;
}

export interface TtnConnectionRow {
  id: string;
  organization_id: string;
  is_enabled: boolean;
  ttn_region: string;
  ttn_api_key_encrypted: string | null;
  ttn_api_key_last4: string | null;
  ttn_webhook_secret_encrypted: string | null;
  ttn_webhook_secret_last4: string | null;
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
 * Get the global TTN Application ID from environment
 * This is the single shared application for the entire platform
 */
export function getGlobalApplicationId(): string {
  const appId = Deno.env.get("TTN_APPLICATION_ID");
  if (!appId) {
    throw new Error("TTN_APPLICATION_ID environment variable is not set");
  }
  return appId;
}

/**
 * Get TTN configuration for a specific organization
 * Uses the global TTN_APPLICATION_ID, combined with org's API key and region
 * Returns null if TTN is not configured/enabled for the org
 */
export async function getTtnConfigForOrg(
  supabaseAdmin: SupabaseClient,
  organizationId: string,
  options?: { requireEnabled?: boolean }
): Promise<TtnConfig | null> {
  const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") || 
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(0, 32) || "";

  // Get global application ID
  let applicationId: string;
  try {
    applicationId = getGlobalApplicationId();
  } catch (e) {
    console.error("[getTtnConfigForOrg] Missing TTN_APPLICATION_ID:", e);
    return null;
  }

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
    applicationId,
    identityBaseUrl: IDENTITY_SERVER_URL,
    regionalBaseUrl: REGIONAL_URLS[region] || REGIONAL_URLS.nam1,
    webhookSecret,
    isEnabled: settings.is_enabled || false,
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
 * Test TTN API key permissions for the global application
 * Uses the REGIONAL server (not Identity Server) since that's where uplinks flow
 * Optionally tests if a specific device exists
 */
export async function testTtnConnection(
  config: TtnConfig,
  options?: { testDeviceId?: string }
): Promise<TtnTestResult> {
  const testedAt = new Date().toISOString();
  const appEndpoint = `/api/v3/applications/${config.applicationId}`;
  const clusterTested = config.region;

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
    // Step 1: Test application access on the REGIONAL server (where uplinks flow)
    console.log(`[testTtnConnection] Testing app on regional server: ${config.regionalBaseUrl}${appEndpoint}`);
    
    const appResponse = await fetch(
      `${config.regionalBaseUrl}${appEndpoint}`,
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
      console.error(`[testTtnConnection] Regional app test failed: ${appResponse.status} ${errorText}`);

      let error: string;
      let hint: string;

      if (appResponse.status === 401) {
        error = "Invalid or expired API key";
        hint = "Generate a new API key in TTN Console → Applications → API keys";
      } else if (appResponse.status === 403) {
        error = "Insufficient permissions on this cluster";
        hint = `Your API key may not have rights for ${config.applicationId} on the ${config.region} cluster. Check that your API key was created for this cluster.`;
      } else if (appResponse.status === 404) {
        error = "Application not found on this cluster";
        hint = `Application '${config.applicationId}' doesn't exist on ${config.region}. If your gateway is on a different cluster, update the Region setting.`;
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

    // Step 2: Optionally test specific device exists
    let deviceTest: TtnTestResult['deviceTest'] = undefined;
    
    if (options?.testDeviceId) {
      const deviceEndpoint = `/api/v3/applications/${config.applicationId}/devices/${options.testDeviceId}`;
      console.log(`[testTtnConnection] Testing device: ${config.regionalBaseUrl}${deviceEndpoint}`);
      
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
