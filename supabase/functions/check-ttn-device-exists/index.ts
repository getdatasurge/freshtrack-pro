import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deobfuscateKey, normalizeDevEui, generateTtnDeviceId, getClusterBaseUrl, getLast4 } from "../_shared/ttnConfig.ts";
import { TTN_IDENTITY_URL, TTN_REGIONAL_URL, assertValidTtnHost, logTtnApiCallWithCred } from "../_shared/ttnBase.ts";

const BUILD_VERSION = "check-ttn-device-exists-v6.0-fallback-per-device-20260211";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// REMOVED: Hard-coded IDENTITY_SERVER_URL = eu1
// Now uses getClusterBaseUrl() from ttnConfig.ts for cluster-locked operation

function normalizeRegion(input: string | null | undefined): string {
  const raw = (input || "nam1").toLowerCase().trim();
  // Accept: "nam1", "nam1.cloud.thethings.network", "https://nam1.cloud.thethings.network"
  const withoutProto = raw.replace(/^https?:\/\//, "");
  const firstPart = withoutProto.split(".")[0];
  return firstPart || "nam1";
}

interface CheckRequest {
  sensor_id?: string;
  sensor_ids?: string[];
}

interface CheckResult {
  sensor_id: string;
  organization_id: string;
  provisioning_state: "not_configured" | "unknown" | "exists_in_ttn" | "missing_in_ttn" | "error";
  ttn_device_id?: string;
  ttn_app_id?: string;
  ttn_cluster?: string;
  error?: string;
  checked_at: string;
}

interface TTNConfig {
  api_key: string;
  application_id: string;
  cluster: string;
}

interface TTNDeviceListItem {
  ids?: {
    device_id?: string;
    dev_eui?: string;
  };
}

// Type alias for Supabase client in edge functions
// deno-lint-ignore no-explicit-any
type SupabaseAnyClient = SupabaseClient<any, any, any>;

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[check-ttn-device-exists] [${requestId}] Build: ${BUILD_VERSION}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ 
      status: "ok", 
      function: "check-ttn-device-exists",
      version: BUILD_VERSION,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: CheckRequest = await req.json();
    const sensorIds: string[] = body.sensor_ids || (body.sensor_id ? [body.sensor_id] : []);

    if (sensorIds.length === 0) {
      return new Response(JSON.stringify({ error: "No sensor_id or sensor_ids provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[check-ttn-device-exists] [${requestId}] Checking ${sensorIds.length} sensor(s)`);

    // Fetch sensors with their org info
    const { data: sensors, error: sensorsError } = await supabase
      .from("lora_sensors")
      .select("id, dev_eui, ttn_device_id, ttn_application_id, organization_id, name")
      .in("id", sensorIds)
      .is("deleted_at", null);

    if (sensorsError) {
      console.error(`[check-ttn-device-exists] [${requestId}] Error fetching sensors:`, sensorsError);
      throw new Error(`Failed to fetch sensors: ${sensorsError.message}`);
    }

    if (!sensors || sensors.length === 0) {
      return new Response(JSON.stringify({ error: "No sensors found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique org IDs
    const orgIds = [...new Set(sensors.map((s) => s.organization_id))];
    console.log(`[check-ttn-device-exists] [${requestId}] Unique orgs: ${orgIds.length}`);

    // Fetch TTN configs for all orgs from ttn_connections table
    const { data: ttnConfigs, error: configError } = await supabase
      .from("ttn_connections")
      .select("organization_id, ttn_api_key_encrypted, ttn_application_id, ttn_region")
      .in("organization_id", orgIds)
      .eq("is_enabled", true);

    if (configError) {
      console.error(`[check-ttn-device-exists] [${requestId}] Error fetching TTN configs:`, configError);
    }

    console.log(`[check-ttn-device-exists] [${requestId}] Found ${ttnConfigs?.length || 0} TTN configs`);

    // Build org -> config map with deobfuscated keys
    const configMap = new Map<string, TTNConfig>();
    for (const cfg of ttnConfigs || []) {
      if (cfg.ttn_api_key_encrypted && cfg.ttn_application_id && cfg.ttn_region) {
        const apiKey = deobfuscateKey(cfg.ttn_api_key_encrypted, cfg.organization_id);
        const region = normalizeRegion(cfg.ttn_region);
        
        configMap.set(cfg.organization_id, {
          api_key: apiKey,
          application_id: cfg.ttn_application_id,
          cluster: region,
        });
      }
    }

    // Group sensors by organization for efficient TTN lookups
    const sensorsByOrg = new Map<string, typeof sensors>();
    for (const sensor of sensors) {
      const orgSensors = sensorsByOrg.get(sensor.organization_id) || [];
      orgSensors.push(sensor);
      sensorsByOrg.set(sensor.organization_id, orgSensors);
    }

    const results: CheckResult[] = [];
    const now = new Date().toISOString();

    // Process each org: list all devices once, then match by DevEUI
    for (const [orgId, orgSensors] of sensorsByOrg.entries()) {
      const config = configMap.get(orgId);
      
      if (!config) {
        // No TTN config for this org - mark all sensors as not_configured
        for (const sensor of orgSensors) {
          const result: CheckResult = {
            sensor_id: sensor.id,
            organization_id: orgId,
            provisioning_state: sensor.dev_eui ? "not_configured" : "not_configured",
            error: "TTN not configured for organization",
            checked_at: now,
          };
          await updateSensor(supabase, sensor.id, result);
          results.push(result);
        }
        continue;
      }

      console.log(`[check-ttn-device-exists] [${requestId}] Org ${orgId}: Listing devices from TTN app ${config.application_id}`);

      // Cross-cluster: Device registry queries go to Identity Server (EU1)
      // The device list is stored in the IS, not regional clusters
      const clusterUrl = TTN_IDENTITY_URL;
      
      // Validate host
      assertValidTtnHost(`${clusterUrl}/api/v3/applications/${config.application_id}`, "IS");
      
      // List all devices from TTN Identity Server (single API call per org)
      let ttnDeviceMap: Map<string, string> | null = null; // normalized_dev_eui -> device_id
      let listError: string | null = null;

      try {
        const listUrl = `${clusterUrl}/api/v3/applications/${config.application_id}/devices?field_mask=ids.device_id,ids.dev_eui&limit=1000`;
        
        // Enhanced logging with credential fingerprint
        const credLast4 = getLast4(config.api_key);
        logTtnApiCallWithCred(
          "check-ttn-device-exists", 
          "GET", 
          `/api/v3/applications/${config.application_id}/devices`, 
          "list_devices_for_check", 
          requestId,
          credLast4,
          orgId,
          config.application_id,
          undefined,
          clusterUrl
        );
        
        const listResponse = await fetch(listUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${config.api_key}`,
            "Content-Type": "application/json",
          },
        });

        if (listResponse.ok) {
          const listData = await listResponse.json();
          const devices = (listData.end_devices || []) as TTNDeviceListItem[];
          
          ttnDeviceMap = new Map();
          for (const device of devices) {
            if (device.ids?.dev_eui && device.ids?.device_id) {
              const normalizedDevEui = normalizeDevEui(device.ids.dev_eui);
              if (!normalizedDevEui) continue;
              ttnDeviceMap.set(normalizedDevEui, device.ids.device_id);
            }
          }
          
          console.log(`[check-ttn-device-exists] [${requestId}] Org ${orgId}: Found ${ttnDeviceMap.size} devices with DevEUI in TTN (cluster: ${config.cluster})`);
        } else if (listResponse.status === 403) {
          // Handle 403 with better context - check provisioning status
          const errorBody = await listResponse.text();
          console.error(`[check-ttn-device-exists] [${requestId}] Org ${orgId}: 403 error - ${errorBody.substring(0, 200)}`);
          
          if (errorBody.includes("no_application_rights") || errorBody.includes("forbidden")) {
            // Query provisioning_status for this org
            const { data: connStatus } = await supabase
              .from("ttn_connections")
              .select("provisioning_status, provisioning_error")
              .eq("organization_id", orgId)
              .single();
            
            if (connStatus?.provisioning_status === "failed") {
              listError = `TTN provisioning failed: ${connStatus.provisioning_error || "API key creation failed"}. Go to Settings → Developer → TTN Connection to retry provisioning.`;
            } else if (connStatus?.provisioning_status === "pending") {
              listError = `TTN provisioning incomplete. Go to Settings → Developer → TTN Connection to complete setup.`;
            } else {
              listError = `API key lacks rights for application '${config.application_id}'. This may indicate a stale or orphaned API key. Try re-provisioning in Settings → Developer → TTN Connection.`;
            }
          } else {
            listError = `TTN API error 403: ${errorBody.substring(0, 200)}`;
          }
        } else {
          listError = `TTN API error ${listResponse.status}: ${await listResponse.text().then(t => t.substring(0, 200))}`;
          console.error(`[check-ttn-device-exists] [${requestId}] Org ${orgId}: ${listError}`);
        }
      } catch (err) {
        listError = err instanceof Error ? err.message : String(err);
        console.error(`[check-ttn-device-exists] [${requestId}] Org ${orgId}: List devices error:`, err);
      }

      // Process each sensor in this org
      for (const sensor of orgSensors) {
        const result: CheckResult = {
          sensor_id: sensor.id,
          organization_id: orgId,
          provisioning_state: "unknown",
          ttn_app_id: config.application_id,
          ttn_cluster: config.cluster,
          checked_at: now,
        };

        // Check if sensor has dev_eui
        if (!sensor.dev_eui) {
          result.provisioning_state = "not_configured";
          result.error = "Sensor missing DevEUI";
          await updateSensor(supabase, sensor.id, result);
          results.push(result);
          continue;
        }

        // If we failed to list devices, try per-device GET fallback instead of giving up
        if (listError) {
          const fallbackResult = await checkSingleDevice(
            sensor, config, orgId, requestId, now
          );
          if (fallbackResult) {
            await updateSensor(supabase, sensor.id, fallbackResult);
            results.push(fallbackResult);
            continue;
          }
          // Fallback also failed — report the original list error
          result.provisioning_state = "error";
          result.error = listError;
          await updateSensor(supabase, sensor.id, result);
          results.push(result);
          continue;
        }

        // Look up sensor's DevEUI in the TTN device map
        const normalizedDevEui = normalizeDevEui(sensor.dev_eui);
        if (!normalizedDevEui) {
          result.provisioning_state = "not_configured";
          result.error = "Invalid DevEUI format";
          await updateSensor(supabase, sensor.id, result);
          results.push(result);
          continue;
        }
        const ttnDeviceId = ttnDeviceMap?.get(normalizedDevEui);

        if (ttnDeviceId) {
          result.provisioning_state = "exists_in_ttn";
          result.ttn_device_id = ttnDeviceId;
          console.log(`[check-ttn-device-exists] [${requestId}] ${sensor.name}: exists_in_ttn (${ttnDeviceId})`);
        } else {
          // Not found in device list — try per-device GET as fallback
          // (handles pagination edge cases or delayed IS replication)
          const fallbackResult = await checkSingleDevice(
            sensor, config, orgId, requestId, now
          );
          if (fallbackResult && fallbackResult.provisioning_state === "exists_in_ttn") {
            console.log(`[check-ttn-device-exists] [${requestId}] ${sensor.name}: found via per-device GET fallback`);
            await updateSensor(supabase, sensor.id, fallbackResult);
            results.push(fallbackResult);
            continue;
          }

          result.provisioning_state = "missing_in_ttn";
          console.log(`[check-ttn-device-exists] [${requestId}] ${sensor.name}: missing_in_ttn`);
        }

        await updateSensor(supabase, sensor.id, result);
        results.push(result);
      }
    }

    // Summary logging
    const summary = {
      total: results.length,
      exists_in_ttn: results.filter(r => r.provisioning_state === "exists_in_ttn").length,
      missing_in_ttn: results.filter(r => r.provisioning_state === "missing_in_ttn").length,
      not_configured: results.filter(r => r.provisioning_state === "not_configured").length,
      error: results.filter(r => r.provisioning_state === "error").length,
    };
    console.log(`[check-ttn-device-exists] [${requestId}] Summary:`, summary);

    return new Response(
      JSON.stringify({
        success: true,
        checked_count: results.length,
        summary,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error(`[check-ttn-device-exists] [${requestId}] Unhandled error:`, err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Fallback: check a single device via direct GET on Identity Server (EU1),
 * then try regional cluster (NAM1) if not found on EU1.
 * Returns a CheckResult if the device was found, or null if both clusters 404.
 */
async function checkSingleDevice(
  sensor: { id: string; dev_eui: string; name: string },
  config: TTNConfig,
  orgId: string,
  requestId: string,
  checkedAt: string,
): Promise<CheckResult | null> {
  const expectedDeviceId = generateTtnDeviceId(sensor.dev_eui);
  if (!expectedDeviceId) return null;

  const clusters = [
    { label: "EU1 (Identity Server)", url: TTN_IDENTITY_URL },
    { label: "NAM1 (Regional)", url: TTN_REGIONAL_URL },
  ];

  for (const cluster of clusters) {
    try {
      const deviceUrl = `${cluster.url}/api/v3/applications/${config.application_id}/devices/${expectedDeviceId}?field_mask=ids.device_id,ids.dev_eui`;
      console.log(`[check-ttn-device-exists] [${requestId}] ${sensor.name}: per-device GET on ${cluster.label}`);

      const resp = await fetch(deviceUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.api_key}`,
          "Content-Type": "application/json",
        },
      });

      if (resp.ok) {
        return {
          sensor_id: sensor.id,
          organization_id: orgId,
          provisioning_state: "exists_in_ttn",
          ttn_device_id: expectedDeviceId,
          ttn_app_id: config.application_id,
          ttn_cluster: config.cluster,
          checked_at: checkedAt,
        };
      }

      if (resp.status === 404) {
        console.log(`[check-ttn-device-exists] [${requestId}] ${sensor.name}: 404 on ${cluster.label}`);
        continue; // Try next cluster
      }

      // Non-404 error — don't keep trying, report connection error
      const errBody = await resp.text().then(t => t.substring(0, 200));
      console.error(`[check-ttn-device-exists] [${requestId}] ${sensor.name}: ${resp.status} on ${cluster.label}: ${errBody}`);
      return {
        sensor_id: sensor.id,
        organization_id: orgId,
        provisioning_state: "error",
        ttn_app_id: config.application_id,
        ttn_cluster: config.cluster,
        error: `Connection error (${resp.status}): Unable to reach TTN. Check your network settings or try again later.`,
        checked_at: checkedAt,
      };
    } catch (err) {
      console.error(`[check-ttn-device-exists] [${requestId}] ${sensor.name}: network error on ${cluster.label}:`, err);
      return {
        sensor_id: sensor.id,
        organization_id: orgId,
        provisioning_state: "error",
        ttn_app_id: config.application_id,
        ttn_cluster: config.cluster,
        error: `Connection error: ${err instanceof Error ? err.message : "Network failure"}. Check your internet connection.`,
        checked_at: checkedAt,
      };
    }
  }

  // 404 on both clusters — device genuinely not found
  return null;
}

async function updateSensor(
  supabase: SupabaseAnyClient,
  sensorId: string,
  result: CheckResult
): Promise<void> {
  const updates: Record<string, string | null> = {
    provisioning_state: result.provisioning_state,
    last_provision_check_at: result.checked_at,
    last_provision_check_error: result.error || null,
  };

  // Only update TTN fields if we found the device
  if (result.provisioning_state === "exists_in_ttn") {
    if (result.ttn_device_id) updates.ttn_device_id = result.ttn_device_id;
    if (result.ttn_app_id) updates.ttn_application_id = result.ttn_app_id;
    if (result.ttn_cluster) updates.ttn_cluster = result.ttn_cluster;
  } else if (result.provisioning_state === "missing_in_ttn" || result.provisioning_state === "not_configured") {
    // Store cluster/app for context even if device is missing
    if (result.ttn_cluster) updates.ttn_cluster = result.ttn_cluster;
    if (result.ttn_app_id) updates.ttn_application_id = result.ttn_app_id;
  }

  const { error } = await supabase
    .from("lora_sensors")
    .update(updates)
    .eq("id", sensorId);

  if (error) {
    console.error(`[check-ttn-device-exists] Failed to update sensor ${sensorId}:`, error);
  }
}
