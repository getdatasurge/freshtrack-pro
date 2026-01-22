/**
 * Shared TTN configuration helper for all edge functions
 * 
 * ARCHITECTURE: Per-Organization TTN Applications
 * Each organization has its own TTN Application, API key, and webhook secret.
 * This provides complete tenant isolation - uplinks from Org A cannot be 
 * processed under Org B even if device payloads are spoofed.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  CLUSTER_BASE_URL, 
  CLUSTER_HOST, 
  TTN_BASE_URL, 
  assertClusterHost, 
  assertNam1Only,
  identifyPlane,
  logTtnApiCall,
  buildTtnUrl,
} from "./ttnBase.ts";

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
  clusterBaseUrl: string;      // THE ONLY TTN URL - all planes use this
  webhookSecret?: string;
  webhookUrl?: string;
  isEnabled: boolean;
  provisioningStatus: string;
  // Gateway-specific API key (user-scoped, has gateway rights)
  gatewayApiKey?: string;
  hasGatewayKey: boolean;
}

export interface TtnConnectionRow {
  id: string;
  organization_id: string;
  is_enabled: boolean;
  ttn_region: string;
  // TTN Organization (created first for better permission isolation)
  ttn_organization_id: string | null;
  ttn_organization_name: string | null;
  ttn_org_api_key_encrypted: string | null;
  ttn_org_api_key_last4: string | null;
  ttn_org_api_key_id: string | null;
  // TTN Application (created under organization)
  ttn_application_id: string | null;
  ttn_application_name: string | null;
  ttn_api_key_encrypted: string | null;
  ttn_api_key_last4: string | null;
  ttn_api_key_id: string | null;
  // Gateway-specific API key (org-scoped for gateway provisioning)
  ttn_gateway_api_key_encrypted: string | null;
  ttn_gateway_api_key_last4: string | null;
  ttn_gateway_api_key_id: string | null;
  ttn_gateway_rights_verified: boolean | null;
  // Webhook credentials
  ttn_webhook_secret_encrypted: string | null;
  ttn_webhook_secret_last4: string | null;
  ttn_webhook_url: string | null;
  provisioning_status: string | null;
  provisioning_error: string | null;
  ttn_application_provisioned_at: string | null;
}

// ============================================================================
// NAM1-ONLY HARD LOCK
// All TTN API operations MUST target the NAM1 cluster exclusively.
// This prevents split-brain provisioning and ensures consistent device registration.
// ============================================================================

// Re-export from canonical source for backward compatibility
export { 
  CLUSTER_BASE_URL,
  CLUSTER_HOST,
  TTN_BASE_URL, 
  assertNam1Only,
  assertClusterHost,
  identifyPlane,
  logTtnApiCall,
  buildTtnUrl,
} from "./ttnBase.ts";

// @deprecated - Use CLUSTER_BASE_URL directly. Kept for backward compatibility only.
export const REGIONAL_URLS: Record<string, string> = {
  nam1: CLUSTER_BASE_URL,
  // Other clusters removed - NAM1-ONLY mode enforced
};

/**
 * Mask EUI values for secure logging (never expose full DevEUI/JoinEUI in logs)
 */
export function maskEui(eui: string | null | undefined): string {
  if (!eui) return "[no-eui]";
  const clean = eui.replace(/[:\-\s]/g, "").toLowerCase();
  if (clean.length < 8) return "[masked]";
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}

// ============================================================================
// Cluster Lock Helpers (exported for use across edge functions)
// ============================================================================

/**
 * Get the base URL for a TTN cluster region.
 * NAM1-ONLY: Always returns NAM1 regardless of requested region.
 * This enforces single-cluster mode to prevent split-brain provisioning.
 */
export function getClusterBaseUrl(region: string | null | undefined): string {
  const requested = (region || "nam1").toLowerCase().trim();
  if (requested !== "nam1") {
    console.warn(`[getClusterBaseUrl] NAM1-ONLY: Region "${requested}" requested but NAM1 enforced`);
  }
  return TTN_BASE_URL;
}

/**
 * @deprecated Use assertClusterHost() from ttnBase.ts instead.
 * Assert that a TtnConfig is cluster-locked.
 * Now simplified since TtnConfig only has clusterBaseUrl.
 */
export function assertClusterLocked(cfg: TtnConfig): { ok: true; clusterBaseUrl: string } {
  const expected = cfg.clusterBaseUrl;
  
  if (!expected) {
    throw new Error("TTN config missing clusterBaseUrl - configuration error");
  }
  
  // Verify it's actually the correct cluster
  assertClusterHost(`${expected}/api/v3/applications`);
  
  return { ok: true, clusterBaseUrl: expected };
}

// ============================================================================
// Byte-Safe Obfuscation (v2) with Legacy Fallback
// ============================================================================

/**
 * Legacy XOR obfuscation (v1) - kept for backward compatibility
 * This function has known issues with non-ASCII bytes but is needed to read old values
 */
function legacyDeobfuscateKey(encoded: string, salt: string): string {
  try {
    const decoded = atob(encoded);
    const result: number[] = [];
    for (let i = 0; i < decoded.length; i++) {
      result.push(decoded.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
    }
    return String.fromCharCode(...result);
  } catch {
    console.warn("[legacyDeobfuscateKey] Failed to decode:", encoded.substring(0, 20));
    return "";
  }
}

function legacyObfuscateKey(key: string, salt: string): string {
  const result: number[] = [];
  for (let i = 0; i < key.length; i++) {
    result.push(key.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
  }
  return btoa(String.fromCharCode(...result));
}

/**
 * Byte-safe base64 encode for Uint8Array
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Byte-safe base64 decode to Uint8Array
 */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * V2 Byte-safe XOR obfuscation
 * Uses TextEncoder/TextDecoder to handle UTF-8 properly
 * Prefixed with "v2:" to distinguish from legacy format
 */
function obfuscateKeyV2(key: string, salt: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const saltBytes = new TextEncoder().encode(salt);
  const result = new Uint8Array(keyBytes.length);
  
  for (let i = 0; i < keyBytes.length; i++) {
    result[i] = keyBytes[i] ^ saltBytes[i % saltBytes.length];
  }
  
  return `v2:${bytesToBase64(result)}`;
}

function deobfuscateKeyV2(encoded: string, salt: string): string {
  // Strip the "v2:" prefix
  const b64 = encoded.slice(3);
  
  try {
    const encryptedBytes = base64ToBytes(b64);
    const saltBytes = new TextEncoder().encode(salt);
    const result = new Uint8Array(encryptedBytes.length);
    
    for (let i = 0; i < encryptedBytes.length; i++) {
      result[i] = encryptedBytes[i] ^ saltBytes[i % saltBytes.length];
    }
    
    return new TextDecoder().decode(result);
  } catch (err) {
    console.error("[deobfuscateKeyV2] Failed to decode:", err);
    return "";
  }
}

/**
 * Deobfuscate a key - handles b64 (plain base64), v2 (XOR), and legacy formats
 * b64 format: "b64:base64data" (NEW - plain base64, no XOR)
 * v2 format: "v2:base64data" (XOR v2)
 * v1 format: plain base64 (legacy XOR)
 * 
 * TEMPORARY: b64 format bypasses XOR to debug key corruption issues
 */
export function deobfuscateKey(encoded: string, salt: string): string {
  if (!encoded) return "";
  
  // Handle new b64: prefix (plain base64, no XOR)
  if (encoded.startsWith("b64:")) {
    try {
      const b64 = encoded.slice(4);
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    } catch (err) {
      console.error("[deobfuscateKey] Failed to decode b64:", err);
      return "";
    }
  }
  
  // Handle v2: prefix (XOR v2 format)
  if (encoded.startsWith("v2:")) {
    return deobfuscateKeyV2(encoded, salt);
  }
  
  // Fall back to legacy decoding for old stored values
  return legacyDeobfuscateKey(encoded, salt);
}

/**
 * Obfuscate a key - TEMPORARY: uses plain base64 (b64:) to bypass XOR corruption
 * This is for debugging key corruption issues.
 * TODO: Re-enable proper encryption after flow is stable
 */
export function obfuscateKey(key: string, salt: string): string {
  // Use plain base64 with b64: prefix (no XOR)
  const encoder = new TextEncoder();
  const bytes = encoder.encode(key);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `b64:${btoa(binary)}`;
}

/**
 * Export legacy obfuscation for backward-compatible webhook lookup
 */
export function obfuscateLegacy(key: string, salt: string): string {
  return legacyObfuscateKey(key, salt);
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
 * Sanitize a string to be a valid TTN slug: lowercase, alphanumeric + dashes, min 3 chars
 * Strip any @ttn suffix (invalid for TTN org/app IDs)
 */
export function sanitizeTtnSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/@.*$/, '') // Strip @ttn or any @... suffix
    .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with dashes
    .replace(/--+/g, '-') // Collapse multiple dashes
    .replace(/^-|-$/g, '') // Trim leading/trailing dashes
    .slice(0, 36); // TTN max length
}

/**
 * Generate TTN organization ID from organization ID (UUID)
 * Format: fg-org-{first 8 chars of UUID} (lowercase, alphanumeric)
 * 
 * IMPORTANT: Result is a valid TTN slug [a-z0-9-]{3,} without @ttn suffix
 * TTN Organizations provide better permission isolation than user-owned apps.
 */
export function generateTtnOrganizationId(orgId: string): string {
  // Extract first 8 hex characters from UUID (remove dashes, lowercase)
  const shortId = orgId.replace(/-/g, '').slice(0, 8).toLowerCase();

  // Validate we have 8 hex chars
  if (!/^[0-9a-f]{8}$/.test(shortId)) {
    // Fallback: hash the input if it's not a valid UUID
    console.warn(`[generateTtnOrganizationId] Invalid UUID format: ${orgId}, using hash fallback`);
    const hash = Array.from(orgId)
      .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
      .toString(16)
      .replace('-', '')
      .slice(0, 8)
      .padStart(8, '0');
    return sanitizeTtnSlug(`fg-org-${hash}`);
  }

  return sanitizeTtnSlug(`fg-org-${shortId}`);
}

/**
 * Generate a collision-safe TTN organization ID with suffix
 * Used when initial org ID creation fails with 409 but verification also fails
 */
export function generateCollisionSafeOrgId(orgId: string): string {
  const base = generateTtnOrganizationId(orgId);
  const suffix = crypto.getRandomValues(new Uint8Array(3))
    .reduce((s, b) => s + (b % 36).toString(36), '');
  return sanitizeTtnSlug(`${base}-${suffix}`);
}

/**
 * Generate TTN application ID from organization ID (UUID)
 * Format: fg-{first 8 chars of UUID} (max 11 chars, lowercase, alphanumeric)
 *
 * Using UUID instead of slug ensures:
 * - Globally unique application IDs
 * - No conflicts when orgs have similar names
 * - Consistent format across all organizations
 */
export function generateTtnApplicationId(orgId: string): string {
  // Extract first 8 hex characters from UUID (remove dashes, lowercase)
  const shortId = orgId.replace(/-/g, '').slice(0, 8).toLowerCase();

  // Validate we have 8 hex chars
  if (!/^[0-9a-f]{8}$/.test(shortId)) {
    // Fallback: hash the input if it's not a valid UUID
    console.warn(`[generateTtnApplicationId] Invalid UUID format: ${orgId}, using hash fallback`);
    const hash = Array.from(orgId)
      .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
      .toString(16)
      .replace('-', '')
      .slice(0, 8)
      .padStart(8, '0');
    return `fg-${hash}`;
  }

  return `fg-${shortId}`;
}

/**
 * Generate a collision-safe TTN application ID with random suffix
 * Used when Start Fresh needs a guaranteed unique app ID
 * Format: fg-{first 8 chars of UUID}-{random 4 chars}
 */
export function generateCollisionSafeAppId(orgId: string): string {
  const baseId = generateTtnApplicationId(orgId);
  const suffix = crypto.getRandomValues(new Uint8Array(2))
    .reduce((s, b) => s + (b % 36).toString(36), '');
  return `${baseId}-${suffix}`;
}

/**
 * Look up organization by webhook secret
 * Used by ttn-webhook to authenticate incoming webhooks
 * Returns org_id if found, null otherwise
 * 
 * BACKWARD COMPATIBILITY: Searches for both v2 and legacy (v1) encrypted formats
 * to support both old stored values and newly provisioned organizations.
 */
export async function lookupOrgByWebhookSecret(
  supabaseAdmin: SupabaseClient,
  webhookSecret: string
): Promise<{ organizationId: string; applicationId: string } | null> {
  const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") || 
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(0, 32) || "";
  
  // Compute both v2 and legacy encrypted values for backward compatibility
  const v2EncryptedSecret = obfuscateKey(webhookSecret, encryptionSalt); // Always v2 now
  const legacyEncryptedSecret = obfuscateLegacy(webhookSecret, encryptionSalt); // Legacy format
  
  // Query using .in() to match either format
  const { data, error } = await supabaseAdmin
    .from("ttn_connections")
    .select("organization_id, ttn_application_id")
    .in("ttn_webhook_secret_encrypted", [v2EncryptedSecret, legacyEncryptedSecret])
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

  // Decrypt gateway API key (user-scoped key for gateway provisioning)
  const gatewayApiKey = settings.ttn_gateway_api_key_encrypted
    ? deobfuscateKey(settings.ttn_gateway_api_key_encrypted, encryptionSalt)
    : undefined;

  // NAM1-ONLY: Force region to nam1 regardless of stored setting
  const requestedRegion = (settings.ttn_region || "nam1").toLowerCase();
  const region = "nam1"; // HARD-LOCK to NAM1
  
  if (requestedRegion !== "nam1") {
    console.warn(`[getTtnConfigForOrg] NAM1-ONLY: Stored region "${requestedRegion}" overridden to "nam1"`);
  }
  
  // NAM1-ONLY: Single base URL for ALL planes (Identity + Regional)
  const clusterBaseUrl = TTN_BASE_URL;
  
  console.log(`[getTtnConfigForOrg] NAM1-ONLY: Using ${clusterBaseUrl}`);

  return {
    region,
    apiKey,
    applicationId: applicationId || "",
    clusterBaseUrl,                    // THE ONLY TTN URL
    webhookSecret,
    webhookUrl: settings.ttn_webhook_url || undefined,
    isEnabled: settings.is_enabled || false,
    provisioningStatus: settings.provisioning_status || "not_started",
    gatewayApiKey,
    hasGatewayKey: !!gatewayApiKey && gatewayApiKey.length > 0,
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
    // Step 1: Test application access on cluster base URL
    const baseUrl = config.clusterBaseUrl;
    
    // HARD GUARD: Verify cluster host
    assertClusterHost(`${baseUrl}/api/v3/applications`);
    
    // CLUSTER-LOCK: Log structured API call for debugging
    logTtnApiCall("testTtnConnection", "GET", appEndpoint, "test_app_access", crypto.randomUUID().slice(0, 8));
    
    const appResponse = await fetch(
      `${baseUrl}${appEndpoint}`,
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

    // Step 2: Optionally test device on SAME cluster URL (not regional - all unified now)
    // Only if a device test is requested
    let deviceTest: TtnTestResult['deviceTest'] = undefined;
    
    if (options?.testDeviceId) {
      const deviceEndpoint = `/api/v3/applications/${config.applicationId}/devices/${options.testDeviceId}`;
      // CLUSTER-LOCK: Use same baseUrl for device test (not regionalBaseUrl)
      console.log(JSON.stringify({
        event: "ttn_api_call",
        method: "GET",
        endpoint: deviceEndpoint,
        baseUrl,
        step: "test_device_exists",
        timestamp: new Date().toISOString(),
      }));
      
      const deviceResponse = await fetch(
        `${baseUrl}${deviceEndpoint}`,
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
