import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckRequest {
  sensor_id?: string;
  sensor_ids?: string[];
}

interface CheckResult {
  sensor_id: string;
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

// Type alias for Supabase client in edge functions
// deno-lint-ignore no-explicit-any
type SupabaseAnyClient = SupabaseClient<any, any, any>;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", function: "check-ttn-device-exists" }), {
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

    console.log(`[check-ttn-device-exists] Checking ${sensorIds.length} sensor(s)`);

    // Fetch sensors with their org info
    const { data: sensors, error: sensorsError } = await supabase
      .from("lora_sensors")
      .select("id, dev_eui, ttn_device_id, ttn_application_id, organization_id, name")
      .in("id", sensorIds)
      .is("deleted_at", null);

    if (sensorsError) {
      console.error("[check-ttn-device-exists] Error fetching sensors:", sensorsError);
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

    // Fetch TTN configs for all orgs from ttn_connections table
    const { data: ttnConfigs, error: configError } = await supabase
      .from("ttn_connections")
      .select("organization_id, ttn_api_key_encrypted, ttn_application_id, ttn_region")
      .in("organization_id", orgIds)
      .eq("is_enabled", true);

    if (configError) {
      console.error("[check-ttn-device-exists] Error fetching TTN configs:", configError);
    }

    console.log(`[check-ttn-device-exists] Found ${ttnConfigs?.length || 0} TTN configs for ${orgIds.length} org(s)`);

    // Build org -> config map
    const configMap = new Map<string, TTNConfig>();
    for (const cfg of ttnConfigs || []) {
      if (cfg.ttn_api_key_encrypted && cfg.ttn_application_id && cfg.ttn_region) {
        // Deobfuscate the API key - it may be plain base64 (b64: prefix) or XOR obfuscated
        let apiKey = cfg.ttn_api_key_encrypted;
        try {
          if (apiKey.startsWith("b64:")) {
            // Plain base64 encoded
            apiKey = atob(apiKey.slice(4));
          } else {
            // Try legacy XOR deobfuscation with org_id as salt
            const salt = cfg.organization_id;
            const decoded = atob(apiKey);
            const saltBytes = new TextEncoder().encode(salt);
            const resultBytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) {
              resultBytes[i] = decoded.charCodeAt(i) ^ saltBytes[i % saltBytes.length];
            }
            apiKey = new TextDecoder().decode(resultBytes);
          }
        } catch (e) {
          console.warn(`[check-ttn-device-exists] Failed to deobfuscate key for org ${cfg.organization_id}, using as-is`);
        }
        
        configMap.set(cfg.organization_id, {
          api_key: apiKey,
          application_id: cfg.ttn_application_id,
          cluster: cfg.ttn_region,
        });
      }
    }

    const results: CheckResult[] = [];
    const now = new Date().toISOString();

    // Process sensors with concurrency limit
    const CONCURRENCY = 3;
    const chunks: typeof sensors[] = [];
    for (let i = 0; i < sensors.length; i += CONCURRENCY) {
      chunks.push(sensors.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (sensor) => {
          const result: CheckResult = {
            sensor_id: sensor.id,
            provisioning_state: "unknown",
            checked_at: now,
          };

          try {
            // Check if sensor has dev_eui
            if (!sensor.dev_eui) {
              result.provisioning_state = "not_configured";
              result.error = "Sensor missing DevEUI";
              await updateSensor(supabase, sensor.id, result);
              return result;
            }

            // Get TTN config for this org
            const config = configMap.get(sensor.organization_id);
            if (!config) {
              result.provisioning_state = "not_configured";
              result.error = "TTN not configured for organization";
              await updateSensor(supabase, sensor.id, result);
              return result;
            }

            // Determine device ID to check
            // Priority: existing ttn_device_id > sensor-{dev_eui}
            const deviceIdToCheck = sensor.ttn_device_id || `sensor-${sensor.dev_eui.toLowerCase()}`;

            console.log(`[check-ttn-device-exists] Checking ${sensor.name} (${deviceIdToCheck}) in ${config.application_id}`);

            // Call TTN API
            const ttnUrl = `https://${config.cluster}.cloud.thethings.network/api/v3/applications/${config.application_id}/devices/${deviceIdToCheck}`;
            
            const ttnResponse = await fetch(ttnUrl, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${config.api_key}`,
                "Content-Type": "application/json",
              },
            });

            if (ttnResponse.ok) {
              // Device exists in TTN
              result.provisioning_state = "exists_in_ttn";
              result.ttn_device_id = deviceIdToCheck;
              result.ttn_app_id = config.application_id;
              result.ttn_cluster = config.cluster;
              console.log(`[check-ttn-device-exists] ${sensor.name}: exists_in_ttn`);
            } else if (ttnResponse.status === 404) {
              // Device not found in TTN
              result.provisioning_state = "missing_in_ttn";
              result.ttn_cluster = config.cluster;
              result.ttn_app_id = config.application_id;
              console.log(`[check-ttn-device-exists] ${sensor.name}: missing_in_ttn`);
            } else {
              // Some other error
              const errorText = await ttnResponse.text();
              result.provisioning_state = "error";
              result.error = `TTN API error ${ttnResponse.status}: ${errorText.substring(0, 200)}`;
              console.error(`[check-ttn-device-exists] ${sensor.name}: error - ${result.error}`);
            }

            await updateSensor(supabase, sensor.id, result);
          } catch (err) {
            result.provisioning_state = "error";
            result.error = err instanceof Error ? err.message : String(err);
            console.error(`[check-ttn-device-exists] Error checking ${sensor.name}:`, err);
            await updateSensor(supabase, sensor.id, result);
          }

          return result;
        })
      );

      results.push(...chunkResults);
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked_count: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[check-ttn-device-exists] Unhandled error:", err);
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
