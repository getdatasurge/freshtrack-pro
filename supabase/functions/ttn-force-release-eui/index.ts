/**
 * TTN Force Release EUI Edge Function
 *
 * Admin utility function to manually release stuck DevEUIs from TTN.
 * Searches across all TTN clusters (nam1, eu1, au1) to find and purge
 * orphaned devices that are preventing re-provisioning.
 *
 * Use this when:
 * - A DevEUI is locked with "already registered in application X"
 * - The application X no longer exists or is inaccessible
 * - Normal deprovisioning failed to release the DevEUI
 *
 * Requires a TTN API key with sufficient permissions to delete devices
 * across all clusters being searched.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const BUILD_VERSION = "ttn-force-release-eui-v1.0-20260124";

// TTN cluster URLs to search
const TTN_CLUSTERS = [
  { name: "nam1", url: "https://nam1.cloud.thethings.network" },
  { name: "eu1", url: "https://eu1.cloud.thethings.network" },
  { name: "au1", url: "https://au1.cloud.thethings.network" },
];

interface DeviceSearchResult {
  cluster: string;
  app_id: string;
  device_id: string;
  dev_eui: string;
  purged: boolean;
  error?: string;
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
 * Search for a DevEUI on a specific cluster
 */
async function searchDevEuiOnCluster(
  clusterUrl: string,
  devEui: string,
  apiKey: string
): Promise<TtnDevice[]> {
  try {
    const response = await fetch(
      `${clusterUrl}/api/v3/end_devices?dev_eui=${devEui}&field_mask=ids`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.end_devices || [];
    }

    if (response.status === 404) {
      return [];
    }

    console.log(`[ForceRelease] Search on ${clusterUrl} returned ${response.status}`);
    return [];
  } catch (err) {
    console.error(`[ForceRelease] Search error on ${clusterUrl}:`, err);
    return [];
  }
}

/**
 * Delete and purge a device from a specific cluster
 */
async function deleteDeviceFromCluster(
  clusterUrl: string,
  appId: string,
  deviceId: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // Delete from all TTN servers on this cluster
  const servers = ["as", "ns", "js", ""];
  let lastError = "";

  for (const server of servers) {
    const endpoint = server
      ? `${clusterUrl}/api/v3/${server}/applications/${appId}/devices/${deviceId}`
      : `${clusterUrl}/api/v3/applications/${appId}/devices/${deviceId}`;

    try {
      console.log(`[ForceRelease] DELETE ${endpoint}`);
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers,
      });

      if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        lastError = `${server || 'IS'}: ${response.status} - ${errorText}`;
        console.log(`[ForceRelease] Delete from ${server || 'IS'} failed: ${lastError}`);
      }
    } catch (err) {
      lastError = `${server || 'IS'}: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`[ForceRelease] Delete error from ${server || 'IS'}:`, err);
    }
  }

  // Purge the device (hard delete)
  try {
    const purgeUrl = `${clusterUrl}/api/v3/applications/${appId}/devices/${deviceId}/purge`;
    console.log(`[ForceRelease] PURGE ${purgeUrl}`);
    const purgeResponse = await fetch(purgeUrl, {
      method: "DELETE",
      headers,
    });

    if (purgeResponse.ok || purgeResponse.status === 404) {
      return { success: true };
    }

    const errorText = await purgeResponse.text();
    return { success: false, error: `Purge failed: ${purgeResponse.status} - ${errorText}` };
  } catch (err) {
    return { success: false, error: `Purge error: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[ttn-force-release-eui] ${BUILD_VERSION} - Request ${requestId}`);

  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({
      ok: true,
      status: "healthy",
      function: "ttn-force-release-eui",
      version: BUILD_VERSION,
      clusters: TTN_CLUSTERS.map(c => c.name),
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const { dev_eui, api_key, clusters } = await req.json();

    if (!dev_eui) {
      return new Response(JSON.stringify({
        success: false,
        error: "dev_eui is required",
        version: BUILD_VERSION
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!api_key) {
      return new Response(JSON.stringify({
        success: false,
        error: "api_key is required (TTN API key with device delete permissions)",
        version: BUILD_VERSION
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Normalize DevEUI
    const normalizedEui = dev_eui.replace(/[:\-\s]/g, '').toLowerCase();
    console.log(`[ForceRelease] Searching for DevEUI: ${normalizedEui}`);

    // Filter clusters if specified
    const clustersToSearch = clusters
      ? TTN_CLUSTERS.filter(c => clusters.includes(c.name))
      : TTN_CLUSTERS;

    const results: DeviceSearchResult[] = [];

    // Search across all clusters
    for (const cluster of clustersToSearch) {
      console.log(`[ForceRelease] Searching ${cluster.name} (${cluster.url})`);

      const devices = await searchDevEuiOnCluster(cluster.url, normalizedEui, api_key);

      if (devices.length === 0) {
        console.log(`[ForceRelease] No devices found on ${cluster.name}`);
        continue;
      }

      console.log(`[ForceRelease] Found ${devices.length} device(s) on ${cluster.name}`);

      // Delete each device found
      for (const device of devices) {
        const appId = device.ids?.application_ids?.application_id;
        const deviceId = device.ids?.device_id;
        const devEui = device.ids?.dev_eui;

        if (!appId || !deviceId) {
          console.log(`[ForceRelease] Skipping device with missing IDs:`, device);
          continue;
        }

        console.log(`[ForceRelease] Found device ${deviceId} in app ${appId} on ${cluster.name}`);

        const deleteResult = await deleteDeviceFromCluster(
          cluster.url,
          appId,
          deviceId,
          api_key
        );

        results.push({
          cluster: cluster.name,
          app_id: appId,
          device_id: deviceId,
          dev_eui: devEui || normalizedEui,
          purged: deleteResult.success,
          error: deleteResult.error,
        });
      }
    }

    // Wait for TTN to propagate changes
    if (results.length > 0) {
      console.log(`[ForceRelease] Waiting for TTN propagation...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Verify the DevEUI is released
    let stillRegistered = false;
    let registeredLocation: string | null = null;

    for (const cluster of clustersToSearch) {
      const devices = await searchDevEuiOnCluster(cluster.url, normalizedEui, api_key);
      if (devices.length > 0) {
        stillRegistered = true;
        const appId = devices[0].ids?.application_ids?.application_id;
        registeredLocation = `${cluster.name}/${appId}`;
        break;
      }
    }

    const allPurged = results.every(r => r.purged);
    const success = !stillRegistered && (results.length === 0 || allPurged);

    const response = {
      success,
      dev_eui: normalizedEui,
      request_id: requestId,
      results,
      summary: {
        devices_found: results.length,
        devices_purged: results.filter(r => r.purged).length,
        devices_failed: results.filter(r => !r.purged).length,
      },
      released: !stillRegistered,
      still_registered_at: registeredLocation,
      version: BUILD_VERSION
    };

    console.log(`[ForceRelease] Complete:`, JSON.stringify(response.summary));

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[ForceRelease] Error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      version: BUILD_VERSION
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
