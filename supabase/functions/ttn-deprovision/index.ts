/**
 * TTN Deprovision Edge Function
 *
 * Comprehensive deprovisioning of TTN resources for an organization.
 * Properly cleans up in the correct order to prevent orphaned DevEUIs:
 *
 * 1. Delete + Purge all end devices (releases DevEUIs)
 * 2. Verify each DevEUI is released
 * 3. Delete + Purge application
 * 4. Delete + Purge organization
 * 5. Clear local DB records
 *
 * Uses single-cluster architecture (2026-01-24 fix):
 * - ALL operations use NAM1 - no cross-cluster mixing
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  IDENTITY_SERVER_URL,
  CLUSTER_BASE_URL,
  logTtnApiCallWithCred
} from "../_shared/ttnBase.ts";
import { deobfuscateKey } from "../_shared/ttnConfig.ts";

const BUILD_VERSION = "ttn-deprovision-v1.1-single-cluster-20260124";

interface DeprovisionResult {
  step: string;
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

interface TtnDevice {
  ids?: {
    device_id?: string;
    dev_eui?: string;
    application_ids?: {
      application_id?: string;
    };
  };
}

/**
 * Make a TTN API request with proper logging
 */
async function ttnRequest(
  baseUrl: string,
  endpoint: string,
  method: string,
  apiKey: string,
  requestId: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const url = `${baseUrl}${endpoint}`;
  const apiKeyLast4 = apiKey.slice(-4);

  logTtnApiCallWithCred(
    "ttn-deprovision",
    method,
    endpoint,
    "deprovision",
    requestId,
    apiKeyLast4
  );

  console.log(`[TTN] ${method} ${url}`);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `FrostGuard/${BUILD_VERSION}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    console.log(`[TTN] Response: ${response.status}`, JSON.stringify(data).slice(0, 200));

    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    console.error(`[TTN] Network error:`, err);
    return {
      ok: false,
      status: 0,
      data: { error: err instanceof Error ? err.message : "Network error" }
    };
  }
}

/**
 * Delete and purge a single device from TTN
 * Uses dual-endpoint: IS for registry, data planes for NS/AS/JS
 */
async function deleteAndPurgeDevice(
  appId: string,
  deviceId: string,
  apiKey: string,
  requestId: string
): Promise<DeprovisionResult> {
  console.log(`[Deprovision] Deleting device: ${appId}/${deviceId}`);

  // Step 1: Delete from Application Server (NAM1)
  await ttnRequest(
    CLUSTER_BASE_URL,
    `/api/v3/as/applications/${appId}/devices/${deviceId}`,
    "DELETE",
    apiKey,
    requestId
  );

  // Step 2: Delete from Network Server (NAM1)
  await ttnRequest(
    CLUSTER_BASE_URL,
    `/api/v3/ns/applications/${appId}/devices/${deviceId}`,
    "DELETE",
    apiKey,
    requestId
  );

  // Step 3: Delete from Join Server (NAM1)
  await ttnRequest(
    CLUSTER_BASE_URL,
    `/api/v3/js/applications/${appId}/devices/${deviceId}`,
    "DELETE",
    apiKey,
    requestId
  );

  // Step 4: Delete from Identity Server (NAM1 - single cluster)
  const deleteResult = await ttnRequest(
    IDENTITY_SERVER_URL,
    `/api/v3/applications/${appId}/devices/${deviceId}`,
    "DELETE",
    apiKey,
    requestId
  );

  if (!deleteResult.ok && deleteResult.status !== 404) {
    return {
      step: `delete_device_${deviceId}`,
      success: false,
      error: `Failed to delete device: ${deleteResult.status}`,
      details: deleteResult.data
    };
  }

  // Step 5: Purge from Identity Server (hard delete - releases DevEUI)
  const purgeResult = await ttnRequest(
    IDENTITY_SERVER_URL,
    `/api/v3/applications/${appId}/devices/${deviceId}/purge`,
    "DELETE",
    apiKey,
    requestId
  );

  // 404 on purge is OK - means already gone
  if (!purgeResult.ok && purgeResult.status !== 404) {
    return {
      step: `purge_device_${deviceId}`,
      success: false,
      error: `Failed to purge device: ${purgeResult.status}`,
      details: purgeResult.data
    };
  }

  console.log(`[Deprovision] Device ${deviceId} purged successfully`);
  return { step: `device_${deviceId}`, success: true };
}

/**
 * Verify that a DevEUI has been released from TTN
 */
async function verifyDevEuiReleased(
  devEui: string,
  apiKey: string,
  requestId: string
): Promise<boolean> {
  console.log(`[Deprovision] Verifying DevEUI released: ${devEui}`);

  // Small delay to let TTN propagate the delete
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Search on Identity Server to verify the EUI is truly released
  const searchResult = await ttnRequest(
    IDENTITY_SERVER_URL,
    `/api/v3/end_devices?dev_eui=${devEui}&field_mask=ids`,
    "GET",
    apiKey,
    requestId
  );

  // If we get 404 or empty results, the EUI is released
  if (searchResult.status === 404) return true;

  const devices = (searchResult.data as { end_devices?: TtnDevice[] })?.end_devices;
  if (!devices || devices.length === 0) return true;

  console.log(`[Deprovision] WARNING: DevEUI ${devEui} still registered!`);
  return false;
}

/**
 * Delete and purge a TTN application
 */
async function deleteAndPurgeApplication(
  appId: string,
  apiKey: string,
  requestId: string
): Promise<DeprovisionResult> {
  console.log(`[Deprovision] Deleting application: ${appId}`);

  // Delete application from Identity Server
  const deleteResult = await ttnRequest(
    IDENTITY_SERVER_URL,
    `/api/v3/applications/${appId}`,
    "DELETE",
    apiKey,
    requestId
  );

  if (!deleteResult.ok && deleteResult.status !== 404) {
    return {
      step: "delete_application",
      success: false,
      error: `Failed to delete application: ${deleteResult.status}`,
      details: deleteResult.data
    };
  }

  // Purge application from Identity Server
  const purgeResult = await ttnRequest(
    IDENTITY_SERVER_URL,
    `/api/v3/applications/${appId}/purge`,
    "DELETE",
    apiKey,
    requestId
  );

  if (!purgeResult.ok && purgeResult.status !== 404) {
    return {
      step: "purge_application",
      success: false,
      error: `Failed to purge application: ${purgeResult.status}`,
      details: purgeResult.data
    };
  }

  console.log(`[Deprovision] Application ${appId} purged successfully`);
  return { step: "application", success: true };
}

/**
 * Delete and purge a TTN organization
 */
async function deleteAndPurgeOrganization(
  orgId: string,
  apiKey: string,
  requestId: string
): Promise<DeprovisionResult> {
  console.log(`[Deprovision] Deleting organization: ${orgId}`);

  // Delete organization from Identity Server
  const deleteResult = await ttnRequest(
    IDENTITY_SERVER_URL,
    `/api/v3/organizations/${orgId}`,
    "DELETE",
    apiKey,
    requestId
  );

  if (!deleteResult.ok && deleteResult.status !== 404) {
    return {
      step: "delete_organization",
      success: false,
      error: `Failed to delete organization: ${deleteResult.status}`,
      details: deleteResult.data
    };
  }

  // Purge organization from Identity Server
  const purgeResult = await ttnRequest(
    IDENTITY_SERVER_URL,
    `/api/v3/organizations/${orgId}/purge`,
    "DELETE",
    apiKey,
    requestId
  );

  if (!purgeResult.ok && purgeResult.status !== 404) {
    return {
      step: "purge_organization",
      success: false,
      error: `Failed to purge organization: ${purgeResult.status}`,
      details: purgeResult.data
    };
  }

  console.log(`[Deprovision] Organization ${orgId} purged successfully`);
  return { step: "organization", success: true };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[ttn-deprovision] ${BUILD_VERSION} - Request ${requestId} received`);

  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({
      ok: true,
      status: "healthy",
      function: "ttn-deprovision",
      version: BUILD_VERSION,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const { organization_id, force } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({
        success: false,
        error: "organization_id is required",
        version: BUILD_VERSION
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") ||
      supabaseServiceKey.slice(0, 32);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get TTN config for this org from ttn_connections
    const { data: ttnConnection, error: configError } = await supabase
      .from("ttn_connections")
      .select("*")
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (configError) {
      console.error(`[Deprovision] Error fetching TTN config:`, configError);
      return new Response(JSON.stringify({
        success: false,
        error: `Database error: ${configError.message}`,
        version: BUILD_VERSION
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }

    if (!ttnConnection) {
      console.log(`[Deprovision] No TTN config found for org ${organization_id}`);
      return new Response(JSON.stringify({
        success: true,
        message: "No TTN config found - nothing to deprovision",
        version: BUILD_VERSION
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Decrypt API key - prefer org API key, fallback to app API key
    const encryptedKey = ttnConnection.ttn_org_api_key_encrypted ||
                        ttnConnection.ttn_api_key_encrypted;

    if (!encryptedKey) {
      console.log(`[Deprovision] No API key found for org ${organization_id}`);
      return new Response(JSON.stringify({
        success: false,
        error: "No API key available for deprovisioning",
        version: BUILD_VERSION
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const apiKey = deobfuscateKey(encryptedKey, encryptionSalt);

    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to decrypt API key",
        version: BUILD_VERSION
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const appId = ttnConnection.ttn_application_id;
    const orgId = ttnConnection.ttn_organization_id;

    const results: DeprovisionResult[] = [];
    const releasedEuis: string[] = [];
    const failedEuis: string[] = [];

    // STEP 1: Get all devices in the application
    if (appId) {
      console.log(`[Deprovision] Fetching devices for app: ${appId}`);
      const devicesResult = await ttnRequest(
        IDENTITY_SERVER_URL,
        `/api/v3/applications/${appId}/devices?field_mask=ids`,
        "GET",
        apiKey,
        requestId
      );

      const devices = ((devicesResult.data as { end_devices?: TtnDevice[] })?.end_devices || []) as TtnDevice[];
      console.log(`[Deprovision] Found ${devices.length} devices to clean up`);

      // STEP 2: Delete + Purge each device
      for (const device of devices) {
        const deviceId = device.ids?.device_id;
        const devEui = device.ids?.dev_eui;

        if (deviceId) {
          const result = await deleteAndPurgeDevice(appId, deviceId, apiKey, requestId);
          results.push(result);

          // STEP 3: Verify DevEUI is released
          if (devEui) {
            if (result.success) {
              const released = await verifyDevEuiReleased(devEui, apiKey, requestId);
              if (released) {
                releasedEuis.push(devEui);
              } else {
                failedEuis.push(devEui);
                results.push({
                  step: `verify_eui_${devEui}`,
                  success: false,
                  error: "DevEUI still registered after purge - may need manual cleanup"
                });
              }
            } else {
              failedEuis.push(devEui);
            }
          }
        }
      }

      // STEP 4: Delete + Purge application
      const appResult = await deleteAndPurgeApplication(appId, apiKey, requestId);
      results.push(appResult);
    }

    // STEP 5: Delete + Purge organization (if exists)
    if (orgId) {
      const orgResult = await deleteAndPurgeOrganization(orgId, apiKey, requestId);
      results.push(orgResult);
    }

    // STEP 6: Determine overall success
    const allSuccess = results.every(r => r.success);

    // STEP 7: Clear local DB (even if some devices failed, clear what we can)
    if (allSuccess || force) {
      console.log(`[Deprovision] Clearing local TTN connection settings`);

      const { error: updateError } = await supabase
        .from("ttn_connections")
        .update({
          ttn_api_key_encrypted: null,
          ttn_api_key_last4: null,
          ttn_api_key_id: null,
          ttn_org_api_key_encrypted: null,
          ttn_org_api_key_last4: null,
          ttn_org_api_key_id: null,
          ttn_application_id: null,
          ttn_application_name: null,
          ttn_organization_id: null,
          ttn_organization_name: null,
          ttn_webhook_secret_encrypted: null,
          ttn_webhook_secret_last4: null,
          ttn_webhook_url: null,
          provisioning_status: "deprovisioned",
          provisioning_error: null,
          ttn_application_provisioned_at: null,
          is_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organization_id);

      if (updateError) {
        console.error(`[Deprovision] Failed to clear ttn_connections:`, updateError);
        results.push({
          step: "clear_db",
          success: false,
          error: `Failed to clear database: ${updateError.message}`
        });
      } else {
        results.push({
          step: "clear_db",
          success: true
        });
      }

      // Also clear any device records that reference this org's TTN app
      const { error: sensorsError } = await supabase
        .from("sensors")
        .update({
          ttn_device_id: null,
          provisioned_at: null,
        })
        .eq("organization_id", organization_id);

      if (sensorsError) {
        console.warn(`[Deprovision] Failed to clear sensor TTN references:`, sensorsError);
      }
    }

    const response = {
      success: allSuccess,
      request_id: requestId,
      results,
      summary: {
        devices_processed: results.filter(r => r.step.startsWith('device_')).length,
        devices_released: releasedEuis.length,
        devices_failed: failedEuis.length,
        application_purged: results.find(r => r.step === 'application')?.success || false,
        organization_purged: results.find(r => r.step === 'organization')?.success || false,
        db_cleared: results.find(r => r.step === 'clear_db')?.success || false,
      },
      released_euis: releasedEuis,
      failed_euis: failedEuis,
      version: BUILD_VERSION
    };

    console.log(`[Deprovision] Complete:`, JSON.stringify(response.summary));

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[Deprovision] Error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      version: BUILD_VERSION
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
