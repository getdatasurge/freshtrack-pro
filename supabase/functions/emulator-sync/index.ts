/**
 * Emulator Sync Ingestion Endpoint
 * 
 * Accepts sync bundles from Project 2's emulator containing gateways, devices, and sensors.
 * Validates payload, enforces org tenancy, and upserts data atomically.
 * 
 * Authentication: EMULATOR_SYNC_API_KEY via Authorization: Bearer or X-Emulator-Sync-Key header
 * 
 * Sensor Type Inference Priority:
 * 1. Explicit sensor_type from emulator (highest priority)
 * 2. Infer from decoded_payload field keys (most reliable for real sensors)
 * 3. Infer from model name via device registry
 * 4. Extract model from unit_name naming convention
 * 5. Default to "temperature" (last resort)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  validateEmulatorSyncApiKey, 
  emulatorSyncPayloadSchema,
  validationErrorResponse,
  unauthorizedResponse,
  type EmulatorGatewayInput,
  type EmulatorDeviceInput,
  type EmulatorSensorInput,
} from "../_shared/validation.ts";
import { inferSensorTypeFromModel, isKnownModel } from "../_shared/deviceRegistry.ts";
import { 
  inferSensorTypeFromPayload, 
  inferModelFromPayload,
  extractModelFromUnitId 
} from "../_shared/payloadRegistry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-emulator-sync-key",
};

interface SyncCounts {
  created: number;
  updated: number;
  skipped: number;
}

interface SyncResponse {
  success: boolean;
  sync_run_id: string;
  counts: {
    gateways: SyncCounts;
    devices: SyncCounts;
    sensors: SyncCounts;
  };
  warnings: string[];
  errors: string[];
  processed_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const syncRunId = crypto.randomUUID();
  const processedAt = new Date().toISOString();
  
  console.log(`[emulator-sync] Starting sync run: ${syncRunId}`);

  // Validate API key
  const authResult = validateEmulatorSyncApiKey(req);
  if (!authResult.valid) {
    console.warn(`[emulator-sync] Auth failed: ${authResult.error}`);
    return unauthorizedResponse(authResult.error || "Unauthorized", corsHeaders);
  }

  // Check content length (1MB limit)
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > 1024 * 1024) {
    console.warn(`[emulator-sync] Payload too large: ${contentLength} bytes`);
    return new Response(
      JSON.stringify({ error: "Payload too large", max_bytes: 1048576 }),
      { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse JSON body
  let rawPayload: unknown;
  try {
    rawPayload = await req.json();
  } catch {
    console.error(`[emulator-sync] Invalid JSON in request body`);
    return new Response(
      JSON.stringify({ error: "Invalid JSON in request body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate payload schema
  const parseResult = emulatorSyncPayloadSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    console.warn(`[emulator-sync] Validation failed:`, parseResult.error.issues);
    return validationErrorResponse(parseResult.error, corsHeaders);
  }

  const payload = parseResult.data;
  console.log(`[emulator-sync] Validated payload for org: ${payload.org_id}, gateways: ${payload.gateways.length}, devices: ${payload.devices.length}, sensors: ${payload.sensors.length}`);

  // Initialize Supabase client with service role
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`[emulator-sync] Missing Supabase configuration`);
    return new Response(
      JSON.stringify({ error: "Server misconfiguration" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify org_id exists
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, deleted_at")
    .eq("id", payload.org_id)
    .single();

  if (orgError || !org) {
    console.warn(`[emulator-sync] Organization not found: ${payload.org_id}`);
    return new Response(
      JSON.stringify({ error: "Organization not found", org_id: payload.org_id }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (org.deleted_at) {
    console.warn(`[emulator-sync] Organization is deleted: ${payload.org_id}`);
    return new Response(
      JSON.stringify({ error: "Organization is deleted", org_id: payload.org_id }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[emulator-sync] Org verified: ${org.name} (${payload.org_id})`);

  // Initialize tracking
  const counts: SyncResponse["counts"] = {
    gateways: { created: 0, updated: 0, skipped: 0 },
    devices: { created: 0, updated: 0, skipped: 0 },
    sensors: { created: 0, updated: 0, skipped: 0 },
  };
  const warnings: string[] = [];
  const errors: string[] = [];

  // Process gateways
  for (const gateway of payload.gateways) {
    try {
      const result = await upsertGateway(supabase, payload.org_id, gateway);
      counts.gateways[result]++;
    } catch (err) {
      const msg = `Gateway ${gateway.gateway_eui}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error(`[emulator-sync] ${msg}`);
      counts.gateways.skipped++;
    }
  }

  // Process devices (now org-scoped)
  for (const device of payload.devices) {
    try {
      const result = await upsertDevice(supabase, payload.org_id, device);
      counts.devices[result]++;
      
      // If device has dev_eui, also create corresponding lora_sensor
      if (device.dev_eui) {
        try {
          // Let upsertSensor handle all type inference via its multi-layer chain
          // Only pass sensor_type if explicitly provided - don't pre-determine!
          const sensorData: EmulatorSensorInput = {
            dev_eui: device.dev_eui,
            name: device.name || `Sensor ${device.serial_number}`,
            model: device.model || null,
            manufacturer: device.manufacturer || null,
            status: "pending",
            unit_id: device.unit_id || null,
            site_id: null,
            // Pass unit_name for fallback model extraction
            unit_name: device.name || null,
            // Pass decoded_payload for payload-based type inference
            decoded_payload: (device as { decoded_payload?: Record<string, unknown> }).decoded_payload || null,
          };

          // Only include sensor_type if explicitly provided by device
          if (device.sensor_type) {
            sensorData.sensor_type = device.sensor_type;
          }

          console.log(`[emulator-sync] Auto-sensor from device ${device.serial_number}: explicit_type=${device.sensor_type || 'none'}, model=${device.model || 'none'}, has_payload=${!!(device as { decoded_payload?: Record<string, unknown> }).decoded_payload}`);

          const sensorResult = await upsertSensor(supabase, payload.org_id, sensorData);
          counts.sensors[sensorResult]++;
          console.log(`[emulator-sync] Auto-created sensor for device ${device.serial_number}: ${sensorResult}`);
        } catch (sensorErr) {
          const msg = `Auto-sensor for ${device.serial_number}: ${sensorErr instanceof Error ? sensorErr.message : String(sensorErr)}`;
          warnings.push(msg);
          console.warn(`[emulator-sync] ${msg}`);
        }
      }
    } catch (err) {
      const msg = `Device ${device.serial_number}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error(`[emulator-sync] ${msg}`);
      counts.devices.skipped++;
    }
  }

  // Process sensors
  for (const sensor of payload.sensors) {
    try {
      const result = await upsertSensor(supabase, payload.org_id, sensor);
      counts.sensors[result]++;
    } catch (err) {
      const msg = `Sensor ${sensor.dev_eui}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error(`[emulator-sync] ${msg}`);
      counts.sensors.skipped++;
    }
  }

  // Persist sync run to database for audit trail
  const syncRunData = {
    id: syncRunId,
    organization_id: payload.org_id,
    sync_id: payload.sync_id || null,
    synced_at: payload.synced_at,
    processed_at: processedAt,
    status: errors.length > 0 ? "partial" : "completed",
    counts,
    warnings,
    errors,
    payload_summary: {
      gateways_count: payload.gateways.length,
      devices_count: payload.devices.length,
      sensors_count: payload.sensors.length,
    },
  };

  const { error: syncRunError } = await supabase
    .from("emulator_sync_runs")
    .insert(syncRunData);

  if (syncRunError) {
    console.error(`[emulator-sync] Failed to persist sync run: ${syncRunError.message}`);
    warnings.push(`Failed to persist sync run: ${syncRunError.message}`);
  }

  const response: SyncResponse = {
    success: errors.length === 0,
    sync_run_id: syncRunId,
    counts,
    warnings,
    errors,
    processed_at: processedAt,
  };

  console.log(`[emulator-sync] Sync complete: ${JSON.stringify(counts)}, errors: ${errors.length}`);

  return new Response(
    JSON.stringify(response),
    { 
      status: errors.length === 0 ? 200 : 207,
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
});

// ============= Upsert Functions =============
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

type UpsertResult = "created" | "updated" | "skipped";

async function upsertGateway(
  supabase: SupabaseClient,
  orgId: string,
  gateway: EmulatorGatewayInput
): Promise<UpsertResult> {
  // Check if gateway exists
  const { data: existing } = await supabase
    .from("gateways")
    .select("id, updated_at")
    .eq("organization_id", orgId)
    .eq("gateway_eui", gateway.gateway_eui)
    .single();

  const upsertData = {
    organization_id: orgId,
    gateway_eui: gateway.gateway_eui,
    name: gateway.name,
    status: gateway.status || "pending",
    site_id: gateway.site_id || null,
    description: gateway.description || null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("gateways")
      .update(upsertData)
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
    return "updated";
  } else {
    // Insert new
    const { error } = await supabase
      .from("gateways")
      .insert(upsertData);

    if (error) throw new Error(error.message);
    return "created";
  }
}

async function upsertDevice(
  supabase: SupabaseClient,
  orgId: string,
  device: EmulatorDeviceInput
): Promise<UpsertResult> {
  // Check if device exists by org + serial_number (org-scoped uniqueness)
  const { data: existing } = await supabase
    .from("devices")
    .select("id, updated_at")
    .eq("organization_id", orgId)
    .eq("serial_number", device.serial_number)
    .single();

  const upsertData = {
    organization_id: orgId,
    serial_number: device.serial_number,
    unit_id: device.unit_id || null,
    status: device.status || "inactive",
    mac_address: device.mac_address || null,
    firmware_version: device.firmware_version || null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("devices")
      .update(upsertData)
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
    return "updated";
  } else {
    // Insert new
    const { error } = await supabase
      .from("devices")
      .insert(upsertData);

    if (error) throw new Error(error.message);
    return "created";
  }
}

async function upsertSensor(
  supabase: SupabaseClient,
  orgId: string,
  sensor: EmulatorSensorInput
): Promise<UpsertResult> {
  // Check if sensor exists by org + dev_eui
  const { data: existing } = await supabase
    .from("lora_sensors")
    .select("id, updated_at, status, ttn_device_id, app_key, model")
    .eq("organization_id", orgId)
    .eq("dev_eui", sensor.dev_eui)
    .single();

  // Status priority: don't downgrade from more advanced states
  const statusPriority: Record<string, number> = { 
    active: 4, 
    offline: 3, 
    joining: 2, 
    pending: 1, 
    fault: 0 
  };
  
  const incomingStatus = sensor.status || "pending";
  const existingStatus = existing?.status || "pending";
  const existingPriority = statusPriority[existingStatus] ?? 0;
  const incomingPriority = statusPriority[incomingStatus] ?? 0;
  
  // Only use incoming status if it's more advanced
  const finalStatus = existingPriority >= incomingPriority ? existingStatus : incomingStatus;
  
  // ============= Multi-Layer Sensor Type & Model Inference =============
  // Priority order for sensor_type:
  // 1. Explicit type from emulator (highest)
  // 2. Infer from decoded_payload field keys (most reliable for real sensors)
  // 3. Infer from model name via device registry
  // 4. Default to "temperature" (last resort)
  
  // Extract payload if provided
  const payload = sensor.decoded_payload || {};
  
  // Step 1: Check for explicit sensor_type
  const explicitType = sensor.sensor_type;
  
  // Step 2: Infer type from decoded payload field keys
  const payloadInferredType = inferSensorTypeFromPayload(payload as Record<string, unknown>);
  
  // Step 3: Infer model from payload structure
  const payloadInferredModel = inferModelFromPayload(payload as Record<string, unknown>);
  
  // Step 4: Extract model from unit naming convention (fallback)
  const unitIdModel = extractModelFromUnitId(sensor.unit_name || sensor.name);
  
  // Step 5: Determine final model: explicit > payload-inferred > unit-based > existing
  const finalModel = sensor.model || payloadInferredModel || unitIdModel || existing?.model || null;
  
  // Step 6: Infer type from final model via registry
  const modelInferredType = inferSensorTypeFromModel(finalModel);
  
  // Step 7: Determine final type: explicit > payload > model > default
  const finalType = explicitType || payloadInferredType || modelInferredType || "temperature";
  
  const modelKnown = isKnownModel(finalModel);
  
  // Enhanced logging for debugging inference chain
  console.log(`[emulator-sync] Sensor ${sensor.dev_eui} inference chain:`, {
    explicit_type: explicitType || null,
    payload_type: payloadInferredType,
    model_type: modelInferredType,
    final_type: finalType,
    explicit_model: sensor.model || null,
    payload_model: payloadInferredModel,
    unit_model: unitIdModel,
    final_model: finalModel,
    model_known: modelKnown,
    payload_keys: Object.keys(payload),
  });

  // deno-lint-ignore no-explicit-any
  const upsertData: Record<string, any> = {
    organization_id: orgId,
    dev_eui: sensor.dev_eui,
    name: sensor.name,
    sensor_type: finalType,
    status: finalStatus,
    unit_id: sensor.unit_id || null,
    site_id: sensor.site_id || null,
    manufacturer: sensor.manufacturer || null,
    model: finalModel,
    updated_at: new Date().toISOString(),
  };
  
  // Include OTAA credentials if provided (don't overwrite existing with null)
  if (sensor.app_eui) {
    upsertData.app_eui = sensor.app_eui;
  }
  if (sensor.app_key) {
    upsertData.app_key = sensor.app_key;
  }
  
  // Include TTN registration info if provided (don't overwrite existing with null)
  if (sensor.ttn_device_id) {
    upsertData.ttn_device_id = sensor.ttn_device_id;
  }
  if (sensor.ttn_application_id) {
    upsertData.ttn_application_id = sensor.ttn_application_id;
  }

  if (existing) {
    // Update existing - preserve fields that shouldn't be overwritten
    // Don't clear app_key if we already have one and incoming is empty
    if (existing.app_key && !sensor.app_key) {
      delete upsertData.app_key;
    }
    if (existing.ttn_device_id && !sensor.ttn_device_id) {
      delete upsertData.ttn_device_id;
    }
    
    const { error } = await supabase
      .from("lora_sensors")
      .update(upsertData)
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
    
    console.log(`[emulator-sync] Updated sensor ${sensor.dev_eui}: status=${finalStatus} (was ${existingStatus}), has_app_key=${!!upsertData.app_key || !!existing.app_key}`);
    return "updated";
  } else {
    // Insert new
    const { error } = await supabase
      .from("lora_sensors")
      .insert(upsertData);

    if (error) throw new Error(error.message);
    
    console.log(`[emulator-sync] Created sensor ${sensor.dev_eui}: status=${finalStatus}, has_app_key=${!!upsertData.app_key}`);
    return "created";
  }
}
