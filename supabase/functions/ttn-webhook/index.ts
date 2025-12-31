/**
 * TTN Webhook Edge Function
 * 
 * Receives uplink messages from The Things Network and inserts sensor data.
 * 
 * Security:
 * - Validates webhook secret from TTN_WEBHOOK_API_KEY env var
 * - Accepts secret from X-Webhook-Secret or X-Downlink-Apikey headers
 * - Returns 401 for invalid/missing secret
 * 
 * Device Matching Order:
 * 1. lora_sensors.ttn_device_id === end_device_ids.device_id
 * 2. lora_sensors.dev_eui IN (normalized variants: lower, upper, colon-upper, colon-lower)
 * 3. Legacy devices table fallback
 * 4. Return 202 for unknown devices (never 404 to prevent TTN retries)
 * 
 * Temperature:
 * - Some TTN decoders send temperature in 0.1°F units (raw/10)
 * - Check decoded_payload.temperature_scale for custom scaling
 * - Default behavior: pass through as-is (decoder should send real values)
 * 
 * Online Threshold:
 * - Sensor is considered online if last_seen_at is within 5 minutes
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeDevEui, formatDevEuiForDisplay } from "../_shared/ttnConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-downlink-apikey, x-webhook-secret',
};

interface TTNUplinkMessage {
  end_device_ids: {
    device_id: string;
    application_ids: { application_id: string };
    dev_eui: string;
    join_eui?: string;
  };
  correlation_ids?: string[];
  received_at: string;
  uplink_message?: {
    session_key_id?: string;
    f_port?: number;
    f_cnt?: number;
    frm_payload?: string;
    decoded_payload?: {
      temperature?: number;
      temperature_scale?: number; // Optional: multiply temp by this (e.g., 10 for 0.1°F units)
      humidity?: number;
      battery?: number;
      battery_level?: number; // Alternative field name
      door_open?: boolean;
      [key: string]: unknown;
    };
    rx_metadata?: Array<{
      gateway_ids?: { gateway_id: string };
      rssi?: number;
      snr?: number;
      channel_rssi?: number;
    }>;
    settings?: {
      data_rate?: { lora?: { bandwidth: number; spreading_factor: number } };
      frequency?: string;
    };
    received_at: string;
  };
}

interface LoraSensor {
  id: string;
  organization_id: string;
  site_id: string | null;
  unit_id: string | null;
  dev_eui: string;
  status: string;
  ttn_application_id: string | null;
  sensor_type: string;
  name: string;
  is_primary: boolean;
}

interface LegacyDevice {
  id: string;
  unit_id: string | null;
  status: string;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  // Generate unique request ID for tracing
  const requestId = crypto.randomUUID().slice(0, 8);
  
  // ========================================
  // REQUEST ENTRY LOGGING - Log EVERY request immediately
  // ========================================
  console.log(`[TTN-WEBHOOK] ========== REQUEST ${requestId} ==========`);
  console.log(`[TTN-WEBHOOK] ${requestId} | method: ${req.method}`);
  console.log(`[TTN-WEBHOOK] ${requestId} | url: ${req.url}`);
  console.log(`[TTN-WEBHOOK] ${requestId} | X-Webhook-Secret present: ${req.headers.has('x-webhook-secret')}`);
  console.log(`[TTN-WEBHOOK] ${requestId} | X-Downlink-Apikey present: ${req.headers.has('x-downlink-apikey')}`);
  console.log(`[TTN-WEBHOOK] ${requestId} | Content-Type: ${req.headers.get('content-type') || 'not set'}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`[TTN-WEBHOOK] ${requestId} | Response: 200 OK - CORS preflight`);
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET/HEAD probes (load balancers, TTN health checks)
  // Return 200 to keep webhook status healthy
  if (req.method === 'GET' || req.method === 'HEAD') {
    console.log(`[TTN-WEBHOOK] ${requestId} | Response: 200 OK - Health probe (${req.method})`);
    return new Response(
      JSON.stringify({ ok: true, service: 'ttn-webhook', timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Only process POST requests for actual webhook payloads
  if (req.method !== 'POST') {
    console.log(`[TTN-WEBHOOK] ${requestId} | Response: 200 OK - Non-POST method ignored`);
    return new Response(
      JSON.stringify({ ok: true, message: 'Method accepted but not processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ========================================
  // SECURITY: Validate webhook secret (constant-time comparison)
  // Accept from EITHER X-Webhook-Secret OR X-Downlink-Apikey headers
  // ========================================
  const webhookSecret = Deno.env.get('TTN_WEBHOOK_API_KEY');
  const providedSecretFromHeader = req.headers.get('x-webhook-secret');
  const providedSecretFromApikey = req.headers.get('x-downlink-apikey');
  const providedSecret = providedSecretFromHeader || providedSecretFromApikey || '';
  
  console.log(`[TTN-WEBHOOK] ${requestId} | Expected secret configured: ${webhookSecret ? 'YES' : 'NO'}`);
  console.log(`[TTN-WEBHOOK] ${requestId} | Provided secret length: ${providedSecret.length}`);
  console.log(`[TTN-WEBHOOK] ${requestId} | Secret source: ${providedSecretFromHeader ? 'X-Webhook-Secret' : providedSecretFromApikey ? 'X-Downlink-Apikey' : 'NONE'}`);
  
  if (webhookSecret) {
    if (!secureCompare(providedSecret, webhookSecret)) {
      console.warn(`[TTN-WEBHOOK] ${requestId} | AUTH FAILED - Secret mismatch`);
      console.warn(`[TTN-WEBHOOK] ${requestId} |   Expected length: ${webhookSecret.length}`);
      console.warn(`[TTN-WEBHOOK] ${requestId} |   Provided length: ${providedSecret.length}`);
      console.log(`[TTN-WEBHOOK] ${requestId} | Response: 401 Unauthorized`);
      
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Invalid webhook secret'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[TTN-WEBHOOK] ${requestId} | AUTH SUCCESS - Secret validated`);
  } else {
    console.warn(`[TTN-WEBHOOK] ${requestId} | WARNING: No TTN_WEBHOOK_API_KEY configured - skipping auth`);
  }

  try {
    const payload = await req.json();
    
    // ========================================
    // HANDLE NON-UPLINK EVENTS GRACEFULLY
    // TTN sends various event types: join_accept, downlink_ack, etc.
    // ========================================
    if (!payload.uplink_message) {
      const eventType = payload.join_accept ? 'join_accept' : 
                        payload.downlink_ack ? 'downlink_ack' :
                        payload.downlink_nack ? 'downlink_nack' :
                        payload.downlink_sent ? 'downlink_sent' :
                        payload.downlink_queued ? 'downlink_queued' :
                        payload.downlink_failed ? 'downlink_failed' :
                        payload.service_data ? 'service_data' :
                        'unknown';
      
      console.log(`[TTN-WEBHOOK] ${requestId} | Non-uplink event received: ${eventType}`);
      console.log(`[TTN-WEBHOOK] ${requestId} | device_id: ${payload.end_device_ids?.device_id || 'N/A'}`);
      console.log(`[TTN-WEBHOOK] ${requestId} | correlation_ids: ${JSON.stringify(payload.correlation_ids || [])}`);
      console.log(`[TTN-WEBHOOK] ${requestId} | Response: 202 Accepted - Non-uplink event`);
      
      return new Response(
        JSON.stringify({ 
          accepted: true, 
          processed: false,
          event_type: eventType,
          message: 'Non-uplink event acknowledged'
        }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ttnPayload = payload as TTNUplinkMessage;
    
    // ========================================
    // VERBOSE LOGGING: Incoming uplink
    // ========================================
    const deviceId = ttnPayload.end_device_ids?.device_id || '';
    const rawDevEui = ttnPayload.end_device_ids?.dev_eui || '';
    const applicationId = ttnPayload.end_device_ids?.application_ids?.application_id || '';
    const decoded = ttnPayload.uplink_message?.decoded_payload || {};
    const rxMeta = ttnPayload.uplink_message?.rx_metadata?.[0];
    const rssi = rxMeta?.rssi ?? rxMeta?.channel_rssi;
    const snr = rxMeta?.snr;
    const receivedAt = ttnPayload.uplink_message?.received_at || ttnPayload.received_at || new Date().toISOString();
    const correlationIds = ttnPayload.correlation_ids || [];

    console.log(`[TTN-WEBHOOK] ${requestId} | ========== INCOMING UPLINK ==========`);
    console.log(`[TTN-WEBHOOK] ${requestId} | device_id: ${deviceId}`);
    console.log(`[TTN-WEBHOOK] ${requestId} | dev_eui: ${rawDevEui}`);
    console.log(`[TTN-WEBHOOK] ${requestId} | application_id: ${applicationId}`);
    console.log(`[TTN-WEBHOOK] ${requestId} | correlation_id: ${correlationIds[0] || 'N/A'}`);
    console.log(`[TTN-WEBHOOK] ${requestId} | received_at: ${receivedAt}`);
    console.log(`[TTN-WEBHOOK] ${requestId} | raw temperature: ${decoded.temperature ?? 'N/A'}`);
    console.log(`[TTN-WEBHOOK] ${requestId} | temperature_scale: ${decoded.temperature_scale ?? '1 (default)'}`);
    console.log(`[TTN-WEBHOOK] ${requestId} | humidity: ${decoded.humidity ?? 'N/A'}`);
    console.log(`[TTN-WEBHOOK] ${requestId} | battery: ${decoded.battery ?? decoded.battery_level ?? 'N/A'}`);
    console.log(`[TTN-WEBHOOK] ${requestId} | door_open: ${decoded.door_open ?? 'N/A'}`);
    console.log(`[TTN-WEBHOOK] ${requestId} | rssi: ${rssi ?? 'N/A'}, snr: ${snr ?? 'N/A'}`);

    // Validate required fields - return 202 (not 400) to prevent TTN retries
    if (!rawDevEui) {
      console.warn(`[TTN-WEBHOOK] ${requestId} | Missing dev_eui in payload`);
      console.log(`[TTN-WEBHOOK] ${requestId} | Response: 202 Accepted - Missing dev_eui`);
      return new Response(
        JSON.stringify({ accepted: true, processed: false, reason: 'Missing dev_eui in payload' }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize DevEUI to handle all formats (with/without colons/dashes/spaces)
    const normalizedDevEui = normalizeDevEui(rawDevEui);
    if (!normalizedDevEui) {
      console.warn(`[TTN-WEBHOOK] ${requestId} | Invalid DevEUI format: ${rawDevEui}`);
      console.log(`[TTN-WEBHOOK] ${requestId} | Response: 202 Accepted - Invalid dev_eui format`);
      return new Response(
        JSON.stringify({ accepted: true, processed: false, reason: 'Invalid dev_eui format', dev_eui: rawDevEui }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate all possible match variants for database lookup
    const devEuiLower = normalizedDevEui;                                    // e.g. "0f8fe95caba665d4"
    const devEuiUpper = normalizedDevEui.toUpperCase();                      // e.g. "0F8FE95CABA665D4"
    const devEuiColonUpper = formatDevEuiForDisplay(normalizedDevEui);       // e.g. "0F:8F:E9:5C:AB:A6:65:D4"
    const devEuiColonLower = devEuiColonUpper.toLowerCase();                 // e.g. "0f:8f:e9:5c:ab:a6:65:d4"
    const devEui = devEuiLower; // Keep for backwards compatibility
    
    console.log(`[TTN-WEBHOOK] DevEUI normalized: "${rawDevEui}" → "${normalizedDevEui}"`);
    console.log(`[TTN-WEBHOOK] Will match variants: ${devEuiLower}, ${devEuiUpper}, ${devEuiColonUpper}, ${devEuiColonLower}`);

    // Initialize Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========================================
    // PRIMARY: Look up by ttn_device_id (exact match to device_id)
    // ========================================
    let loraSensor: LoraSensor | null = null;

    if (deviceId) {
      console.log(`[TTN-WEBHOOK] Looking up sensor by ttn_device_id: ${deviceId}`);
      const { data: sensorByDeviceId, error: deviceIdError } = await supabase
        .from('lora_sensors')
        .select('id, organization_id, site_id, unit_id, dev_eui, status, ttn_application_id, sensor_type, name, is_primary')
        .eq('ttn_device_id', deviceId)
        .maybeSingle();

      if (deviceIdError) {
        console.error('[TTN-WEBHOOK] Database error looking up by ttn_device_id:', deviceIdError);
      } else if (sensorByDeviceId) {
        console.log(`[TTN-WEBHOOK] ✓ Found sensor by ttn_device_id: ${sensorByDeviceId.id} (${sensorByDeviceId.name})`);
        loraSensor = sensorByDeviceId;
      }
    }

    // ========================================
    // FALLBACK: Look up by dev_eui (match ALL common formats)
    // ========================================
    if (!loraSensor) {
      console.log(`[TTN-WEBHOOK] Looking up sensor by dev_eui variants...`);
      const { data: sensorByDevEui, error: devEuiError } = await supabase
        .from('lora_sensors')
        .select('id, organization_id, site_id, unit_id, dev_eui, status, ttn_application_id, sensor_type, name, is_primary')
        .or(`dev_eui.eq.${devEuiLower},dev_eui.eq.${devEuiUpper},dev_eui.eq.${devEuiColonUpper},dev_eui.eq.${devEuiColonLower}`)
        .maybeSingle();

      if (devEuiError) {
        console.error('[TTN-WEBHOOK] Database error looking up by dev_eui:', devEuiError);
        throw devEuiError;
      } else if (sensorByDevEui) {
        console.log(`[TTN-WEBHOOK] ✓ Found sensor by dev_eui: ${sensorByDevEui.id} (${sensorByDevEui.name})`);
        console.log(`[TTN-WEBHOOK]   Matched DB dev_eui value: "${sensorByDevEui.dev_eui}"`);
        loraSensor = sensorByDevEui;
      }
    }

    // If found in lora_sensors, use new ownership model
    if (loraSensor) {
      console.log(`[TTN-WEBHOOK] ========== MATCHED SENSOR ==========`);
      console.log(`[TTN-WEBHOOK] sensor_id: ${loraSensor.id}`);
      console.log(`[TTN-WEBHOOK] sensor_name: ${loraSensor.name}`);
      console.log(`[TTN-WEBHOOK] unit_id: ${loraSensor.unit_id || 'NOT ASSIGNED'}`);
      console.log(`[TTN-WEBHOOK] organization_id: ${loraSensor.organization_id}`);
      console.log(`[TTN-WEBHOOK] is_primary: ${loraSensor.is_primary}`);
      console.log(`[TTN-WEBHOOK] status: ${loraSensor.status}`);

      return await handleLoraSensor(supabase, loraSensor, {
        devEui,
        deviceId,
        applicationId,
        decoded,
        rssi,
        receivedAt,
      });
    }

    // ========================================
    // LEGACY FALLBACK: Look up in devices table (BLE) - match ALL formats
    // ========================================
    console.log(`[TTN-WEBHOOK] No lora_sensor found, checking legacy devices table...`);
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, unit_id, status')
      .or(`serial_number.eq.${devEuiLower},serial_number.eq.${devEuiUpper},serial_number.eq.${devEuiColonUpper},serial_number.eq.${devEuiColonLower}`)
      .maybeSingle();

    if (deviceError) {
      console.error('[TTN-WEBHOOK] Database error looking up device:', deviceError);
      throw deviceError;
    }

    if (device) {
      console.log(`[TTN-WEBHOOK] ✓ Found legacy device: ${device.id}`);
      return await handleLegacyDevice(supabase, device, {
        devEui,
        deviceId,
        applicationId,
        decoded,
        rssi,
        receivedAt,
      });
    }

    // ========================================
    // UNKNOWN: DevEUI not found in either table
    // Return 202 Accepted (don't retry) but log for debugging
    // ========================================
    console.warn(`[TTN-WEBHOOK] ${requestId} | ✗ UNKNOWN DEVICE - Not found in database`);
    console.warn(`[TTN-WEBHOOK] ${requestId} |   device_id: ${deviceId}`);
    console.warn(`[TTN-WEBHOOK] ${requestId} |   dev_eui: ${devEui}`);
    console.warn(`[TTN-WEBHOOK] ${requestId} |   application_id: ${applicationId}`);
    console.warn(`[TTN-WEBHOOK] ${requestId} |   gateway: ${rxMeta?.gateway_ids?.gateway_id || 'unknown'}`);
    console.log(`[TTN-WEBHOOK] ${requestId} | Response: 202 Accepted - Unknown device`);

    return new Response(
      JSON.stringify({ 
        accepted: true,
        processed: false,
        reason: 'Unknown device - not registered in FrostGuard',
        dev_eui: devEui,
        device_id: deviceId,
        hint: 'Register this sensor in FrostGuard with the correct DevEUI'
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    // Never return 500 to TTN - always return 2xx to prevent retries
    console.error(`[TTN-WEBHOOK] ${requestId} | Unhandled error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.log(`[TTN-WEBHOOK] ${requestId} | Response: 202 Accepted - Error caught`);
    return new Response(
      JSON.stringify({ 
        accepted: true,
        processed: false,
        error: errorMessage,
        message: 'Error processing webhook, but accepted to prevent retries'
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle uplink from a LoRa sensor (new ownership model)
 * 
 * Temperature Scaling:
 * - Some decoders send temperature in 0.1°F units (e.g., 352 = 35.2°F)
 * - Check decoded_payload.temperature_scale for custom multiplier
 * - If temperature < 10 and no scale specified, check if multiplying by 10 gives reasonable value
 */
async function handleLoraSensor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sensor: LoraSensor,
  data: {
    devEui: string;
    deviceId: string;
    applicationId: string;
    decoded: Record<string, unknown>;
    rssi: number | undefined;
    receivedAt: string;
  }
): Promise<Response> {
  const { devEui, deviceId, applicationId, decoded, rssi, receivedAt } = data;
  
  // ========================================
  // BATTERY: Handle battery_level vs battery field name inconsistency
  // ========================================
  const battery = (decoded.battery ?? decoded.battery_level) as number | undefined;

  // ========================================
  // TEMPERATURE SCALING: Handle decoders that send in 0.1 units
  // ========================================
  let temperature = decoded.temperature as number | undefined;
  if (temperature !== undefined) {
    // Check if decoder provides explicit scale
    const tempScale = (decoded.temperature_scale ?? 1) as number;
    if (tempScale !== 1) {
      const originalTemp = temperature;
      temperature = temperature * tempScale;
      console.log(`[TTN-WEBHOOK] Temperature scaled: ${originalTemp} * ${tempScale} = ${temperature}`);
    } else {
      // Heuristic: If temperature is suspiciously low for food safety (< 10) 
      // and the value * 10 would be reasonable (10-100°F range), apply x10 scaling
      // This handles decoders that send 3.5 instead of 35.2
      if (temperature > 0 && temperature < 10) {
        const scaledTemp = temperature * 10;
        if (scaledTemp >= 10 && scaledTemp <= 100) {
          console.log(`[TTN-WEBHOOK] Temperature auto-scaled (heuristic): ${temperature} * 10 = ${scaledTemp}`);
          temperature = scaledTemp;
        }
      }
    }
  }

  console.log(`[TTN-WEBHOOK] Processing LoRa sensor: ${sensor.name} (${sensor.dev_eui}), org: ${sensor.organization_id}`);
  console.log(`[TTN-WEBHOOK] Final temperature value: ${temperature ?? 'N/A'}`);

  // ========================================
  // SECURITY: Validate ownership via TTN Application ID
  // ========================================
  if (sensor.ttn_application_id && sensor.ttn_application_id !== applicationId) {
    console.error(`[SECURITY VIOLATION] DevEUI ${devEui} received from wrong TTN application!`);
    console.error(`  Expected: ${sensor.ttn_application_id}`);
    console.error(`  Received: ${applicationId}`);
    console.error(`  Org ID: ${sensor.organization_id}`);
    console.log(`[TTN-WEBHOOK] Response: 202 Accepted - Application ID mismatch (security event logged)`);
    
    // Return 202 instead of 403 to prevent TTN retries, but log the security event
    return new Response(
      JSON.stringify({ 
        accepted: true,
        processed: false,
        reason: 'Application ID mismatch - security event logged',
        quarantined: true,
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ========================================
  // Update sensor status (pending/joining → active)
  // ========================================
  const sensorUpdate: Record<string, unknown> = {
    last_seen_at: receivedAt,
    updated_at: new Date().toISOString(),
  };

  // First uplink activates the sensor
  if (sensor.status === 'pending' || sensor.status === 'joining') {
    sensorUpdate.status = 'active';
    if (sensor.status === 'joining') {
      sensorUpdate.last_join_at = receivedAt;
    }
    console.log(`[TTN-WEBHOOK] Sensor ${sensor.name} activated (${sensor.status} → active)`);
  }

  // Update telemetry fields (use normalized battery)
  if (battery !== undefined) {
    sensorUpdate.battery_level = battery;
  }
  if (rssi !== undefined) {
    sensorUpdate.signal_strength = rssi;
  }

  await supabase
    .from('lora_sensors')
    .update(sensorUpdate)
    .eq('id', sensor.id);

  // ========================================
  // Handle unit-assigned sensors (insert readings)
  // SOURCE OF TRUTH: Always use sensor.organization_id, sensor.unit_id
  // NEVER use decoded_payload org_id/site_id/unit_id
  // ========================================
  if (sensor.unit_id) {
    const hasTemperatureData = temperature !== undefined;
    const hasDoorData = decoded.door_open !== undefined;

    // Allow door-only sensors to process without temperature
    if (!hasTemperatureData && !hasDoorData) {
      console.log(`[TTN-WEBHOOK] No temperature or door data in payload for sensor ${sensor.name}, skipping reading insert`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Sensor updated, no temperature or door data to record',
          sensor_id: sensor.id,
          status: sensorUpdate.status || sensor.status,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get previous door state for change detection
    const { data: unit } = await supabase
      .from('units')
      .select('door_state')
      .eq('id', sensor.unit_id)
      .single();

    const previousDoorState = unit?.door_state;
    const currentDoorOpen = decoded.door_open as boolean | undefined;

    // Insert sensor reading with SCALED temperature
    const { data: insertedReading, error: insertError } = await supabase
      .from('sensor_readings')
      .insert({
        unit_id: sensor.unit_id,           // FROM SENSOR RECORD, NOT PAYLOAD
        lora_sensor_id: sensor.id,         // Track which sensor created this reading
        device_id: null,                   // lora_sensors don't use devices table
        temperature: temperature ?? null,  // Use scaled temperature
        humidity: decoded.humidity,
        battery_level: battery,            // Use normalized battery
        signal_strength: rssi,
        door_open: currentDoorOpen,
        source: 'ttn',
        recorded_at: receivedAt,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[TTN-WEBHOOK] Error inserting sensor reading:', insertError);
      throw insertError;
    }

    console.log(`[TTN-WEBHOOK] ========== INSERTED READING ==========`);
    console.log(`[TTN-WEBHOOK] reading_id: ${insertedReading?.id}`);
    console.log(`[TTN-WEBHOOK] unit_id: ${sensor.unit_id}`);
    console.log(`[TTN-WEBHOOK] sensor_id: ${sensor.id}`);
    console.log(`[TTN-WEBHOOK] temperature (final): ${temperature ?? 'N/A'}`);
    console.log(`[TTN-WEBHOOK] humidity: ${decoded.humidity ?? 'N/A'}`);
    console.log(`[TTN-WEBHOOK] battery: ${battery ?? 'N/A'}`);
    console.log(`[TTN-WEBHOOK] door_open: ${currentDoorOpen ?? 'N/A'}`);
    console.log(`[TTN-WEBHOOK] is_primary: ${sensor.is_primary}`);

    // Build unit update - only update temperature fields from PRIMARY sensors
    const unitUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only primary sensors update compliance temperature fields
    if (sensor.is_primary && hasTemperatureData) {
      unitUpdate.last_temp_reading = temperature;  // Use scaled temperature
      unitUpdate.last_reading_at = receivedAt;
      unitUpdate.last_checkin_at = receivedAt;
      unitUpdate.sensor_reliable = true;
      console.log(`[TTN-WEBHOOK] Primary sensor ${sensor.name} updating unit temperature: ${temperature}`);
    } else if (hasTemperatureData) {
      // Non-primary sensors still contribute to checkin tracking
      unitUpdate.last_checkin_at = receivedAt;
      console.log(`[TTN-WEBHOOK] Secondary sensor ${sensor.name} recorded temperature: ${temperature} (not updating unit compliance fields)`);
    }

    // Always update door state if we have door data (regardless of primary status)
    if (currentDoorOpen !== undefined) {
      const newDoorState = currentDoorOpen ? 'open' : 'closed';
      unitUpdate.door_state = newDoorState;
      
      if (previousDoorState !== newDoorState) {
        unitUpdate.door_last_changed_at = receivedAt;
      }
    }

    await supabase
      .from('units')
      .update(unitUpdate)
      .eq('id', sensor.unit_id);

    // Insert door event if state changed
    if (currentDoorOpen !== undefined) {
      const currentState = currentDoorOpen ? 'open' : 'closed';
      
      if (previousDoorState !== currentState) {
        const { error: doorEventError } = await supabase
          .from('door_events')
          .insert({
            unit_id: sensor.unit_id,
            state: currentState,
            occurred_at: receivedAt,
            source: 'ttn',
            metadata: { 
              dev_eui: devEui,
              device_id: deviceId,
              sensor_id: sensor.id,
              sensor_name: sensor.name,
              organization_id: sensor.organization_id,
            }
          });

        if (doorEventError) {
          console.error('[TTN-WEBHOOK] Error inserting door event:', doorEventError);
        } else {
          console.log(`[TTN-WEBHOOK] Inserted door event: ${currentState} for unit ${sensor.unit_id}`);
        }
      }
    }

    console.log(`[TTN-WEBHOOK] Successfully processed TTN uplink from ${devEui} for unit ${sensor.unit_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sensor_id: sensor.id,
        unit_id: sensor.unit_id,
        organization_id: sensor.organization_id,
        temperature: temperature,
        is_primary: sensor.is_primary,
        status: sensorUpdate.status || sensor.status,
        reading_id: insertedReading?.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } else {
    // ========================================
    // Handle unassigned sensors (update status only)
    // ========================================
    console.log(`[TTN-WEBHOOK] Sensor ${sensor.name} (${devEui}) has no unit assigned - telemetry recorded on sensor only`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sensor_id: sensor.id,
        organization_id: sensor.organization_id,
        status: sensorUpdate.status || sensor.status,
        message: 'Sensor updated, no unit assigned for readings',
        hint: 'Assign this sensor to a unit to start recording readings',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle uplink from a legacy BLE device (backward compatibility)
 */
async function handleLegacyDevice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  device: LegacyDevice,
  data: {
    devEui: string;
    deviceId: string;
    applicationId: string;
    decoded: Record<string, unknown>;
    rssi: number | undefined;
    receivedAt: string;
  }
): Promise<Response> {
  const { devEui, deviceId, applicationId, decoded, rssi, receivedAt } = data;

  console.log(`[TTN-WEBHOOK] Processing legacy device: ${devEui} (fallback to devices table)`);

  // Apply same temperature scaling heuristic to legacy devices
  let temperature = decoded.temperature as number | undefined;
  if (temperature !== undefined && temperature > 0 && temperature < 10) {
    const scaledTemp = temperature * 10;
    if (scaledTemp >= 10 && scaledTemp <= 100) {
      console.log(`[TTN-WEBHOOK] Legacy device temperature auto-scaled: ${temperature} * 10 = ${scaledTemp}`);
      temperature = scaledTemp;
    }
  }

  // Validate we have temperature data
  if (temperature === undefined) {
    console.log('[TTN-WEBHOOK] No temperature in decoded payload, skipping insert');
    return new Response(
      JSON.stringify({ success: true, message: 'No temperature data, skipping' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!device.unit_id) {
    console.warn(`[TTN-WEBHOOK] Device ${devEui} not linked to a unit`);
    return new Response(
      JSON.stringify({ 
        accepted: true,
        processed: false,
        reason: 'Device not linked to unit', 
        dev_eui: devEui,
        device_id: device.id,
        hint: 'Link this device to a unit in FrostGuard'
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get previous door state for detecting changes
  const { data: unit } = await supabase
    .from('units')
    .select('door_state')
    .eq('id', device.unit_id)
    .single();

  const previousDoorState = unit?.door_state;
  const currentDoorOpen = decoded.door_open as boolean | undefined;
  const battery = (decoded.battery ?? decoded.battery_level) as number | undefined;

  // Insert sensor reading with scaled temperature
  const { data: insertedReading, error: insertError } = await supabase
    .from('sensor_readings')
    .insert({
      unit_id: device.unit_id,
      device_id: device.id,
      temperature: temperature,
      humidity: decoded.humidity,
      battery_level: battery,
      signal_strength: rssi,
      door_open: currentDoorOpen,
      source: 'ttn',
      recorded_at: receivedAt,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[TTN-WEBHOOK] Error inserting sensor reading:', insertError);
    throw insertError;
  }

  console.log(`[TTN-WEBHOOK] Inserted sensor reading ${insertedReading?.id} for unit ${device.unit_id}`);

  // Update device status
  const deviceUpdate: Record<string, unknown> = {
    last_seen_at: receivedAt,
    status: 'active',
    updated_at: new Date().toISOString(),
  };
  
  if (battery !== undefined) {
    deviceUpdate.battery_level = battery;
    deviceUpdate.battery_last_reported_at = receivedAt;
  }
  if (rssi !== undefined) {
    deviceUpdate.signal_strength = rssi;
  }

  await supabase
    .from('devices')
    .update(deviceUpdate)
    .eq('id', device.id);

  // Update unit with latest reading info (using scaled temperature)
  const unitUpdate: Record<string, unknown> = {
    last_temp_reading: temperature,
    last_reading_at: receivedAt,
    last_checkin_at: receivedAt,
    sensor_reliable: true,
    updated_at: new Date().toISOString(),
  };

  if (currentDoorOpen !== undefined) {
    const newDoorState = currentDoorOpen ? 'open' : 'closed';
    unitUpdate.door_state = newDoorState;
    
    if (previousDoorState !== newDoorState) {
      unitUpdate.door_last_changed_at = receivedAt;
    }
  }

  await supabase
    .from('units')
    .update(unitUpdate)
    .eq('id', device.unit_id);

  // Insert door event if state changed
  if (currentDoorOpen !== undefined) {
    const currentState = currentDoorOpen ? 'open' : 'closed';
    
    if (previousDoorState !== currentState) {
      const { error: doorEventError } = await supabase
        .from('door_events')
        .insert({
          unit_id: device.unit_id,
          state: currentState,
          occurred_at: receivedAt,
          source: 'ttn',
          metadata: { 
            dev_eui: devEui,
            device_id: deviceId,
            application_id: applicationId,
          }
        });

      if (doorEventError) {
        console.error('[TTN-WEBHOOK] Error inserting door event:', doorEventError);
      } else {
        console.log(`[TTN-WEBHOOK] Inserted door event: ${currentState} for unit ${device.unit_id}`);
      }
    }
  }

  console.log(`[TTN-WEBHOOK] Successfully processed TTN uplink from ${devEui} for unit ${device.unit_id}`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      unit_id: device.unit_id,
      device_id: device.id,
      temperature: temperature,
      reading_id: insertedReading?.id,
      legacy: true,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
