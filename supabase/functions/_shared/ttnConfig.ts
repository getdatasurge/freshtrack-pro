/**
 * Shared TTN configuration helper for all edge functions
 * Uses a single global TTN_APPLICATION_ID for the entire platform
 * Multi-tenancy is enforced in Supabase, not by separate TTN applications
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

/**
 * Test TTN API key permissions for the global application
 * Returns a structured result with success/error details
 */
export async function testTtnConnection(
  config: TtnConfig
): Promise<{
  success: boolean;
  error?: string;
  hint?: string;
  statusCode?: number;
  applicationName?: string;
  testedAt: string;
  endpointTested: string;
  effectiveApplicationId: string;
  apiKeyLast4?: string;
}> {
  const testedAt = new Date().toISOString();
  const endpointTested = `/api/v3/applications/${config.applicationId}`;

  if (!config.apiKey) {
    return {
      success: false,
      error: "No API key configured",
      hint: "Add a TTN API key in Settings → Developer → TTN Connection",
      testedAt,
      endpointTested,
      effectiveApplicationId: config.applicationId,
    };
  }

  try {
    const response = await fetch(
      `${config.identityBaseUrl}${endpointTested}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`,
          "Accept": "application/json",
        },
      }
    );

    const apiKeyLast4 = config.apiKey.length >= 4 ? config.apiKey.slice(-4) : undefined;

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        applicationName: data.name || config.applicationId,
        testedAt,
        endpointTested,
        effectiveApplicationId: config.applicationId,
        statusCode: response.status,
        apiKeyLast4,
      };
    }

    const errorText = await response.text();
    console.error(`[testTtnConnection] TTN API error: ${response.status} ${errorText}`);

    let error: string;
    let hint: string;

    if (response.status === 401) {
      error = "Invalid or expired API key";
      hint = "Generate a new API key in TTN Console → Applications → API keys";
    } else if (response.status === 403) {
      error = "Insufficient permissions";
      hint = `Your TTN API key lacks required rights. Create an API key under the TTN Application (${config.applicationId}) with at least:\n• applications:read (view application)\n• end_devices:read (view devices)\n• end_devices:write (if provisioning is needed)`;
    } else if (response.status === 404) {
      error = "Application not found";
      hint = `Application '${config.applicationId}' does not exist in TTN. Contact your administrator to verify the TTN_APPLICATION_ID is correct.`;
    } else {
      error = `TTN API error (${response.status})`;
      hint = errorText.slice(0, 200);
    }

    return {
      success: false,
      error,
      hint,
      statusCode: response.status,
      testedAt,
      endpointTested,
      effectiveApplicationId: config.applicationId,
      apiKeyLast4,
    };
  } catch (fetchError) {
    return {
      success: false,
      error: "Network error",
      hint: fetchError instanceof Error ? fetchError.message : "Connection failed",
      testedAt,
      endpointTested,
      effectiveApplicationId: config.applicationId,
    };
  }
}
