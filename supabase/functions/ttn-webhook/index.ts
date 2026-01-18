/**
 * TTN Webhook Edge Function
 * 
 * Receives uplink messages from The Things Network and inserts sensor data.
 * 
 * SECURITY (Per-Organization Model):
 * - Validates X-Webhook-Secret header against per-org secrets in ttn_connections
 * - Each org has its own unique webhook secret
 * - Org lookup via webhook secret provides tenant isolation
 * - Device lookup also verifies org ownership
 * - Returns 401 for invalid/missing secret
 * 
 * Device Matching Order:
 * 1. lora_sensors.ttn_device_id === end_device_ids.device_id
 * 2. lora_sensors.dev_eui IN (normalized variants: lower, upper, colon-upper, colon-lower)
 * 3. Legacy devices table fallback
 * 4. Return 202 for unknown devices (never 404 to prevent TTN retries)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeDevEui, formatDevEuiForDisplay, lookupOrgByWebhookSecret } from "../_shared/ttnConfig.ts";
import { inferSensorTypeFromPayload, inferModelFromPayload, extractModelFromUnitId } from "../_shared/payloadRegistry.ts";
import { normalizeDoorData, getDoorFieldSource } from "../_shared/payloadNormalization.ts";

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
      temperature_scale?: number;
      humidity?: number;
      battery?: number;
      battery_level?: number;
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
  model: string | null;
}

interface LegacyDevice {
  id: string;
  unit_id: string | null;
  status: string;
  organization_id: string | null;
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
  
  console.log(`[TTN-WEBHOOK] ========== REQUEST ${requestId} ==========`);
  console.log(`[TTN-WEBHOOK] ${requestId} | method: ${req.method}`);
  console.log(`[TTN-WEBHOOK] ${requestId} | X-Webhook-Secret present: ${req.headers.has('x-webhook-secret')}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET/HEAD probes (load balancers, TTN health checks)
  if (req.method === 'GET' || req.method === 'HEAD') {
    return new Response(
      JSON.stringify({ ok: true, service: 'ttn-webhook', timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Only process POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: true, message: 'Method accepted but not processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`[TTN-WEBHOOK] ${requestId} | Missing Supabase environment variables`);
    return new Response(
      JSON.stringify({ accepted: true, processed: false, error: 'Server configuration error' }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ========================================
  // SECURITY: Authenticate via per-org webhook secret
  // ========================================
  const providedSecretFromHeader = req.headers.get('x-webhook-secret');
  const providedSecretFromApikey = req.headers.get('x-downlink-apikey');
  const providedSecret = providedSecretFromHeader || providedSecretFromApikey || '';
  
  console.log(`[TTN-WEBHOOK] ${requestId} | Secret source: ${providedSecretFromHeader ? 'X-Webhook-Secret' : providedSecretFromApikey ? 'X-Downlink-Apikey' : 'NONE'}`);
  
  if (!providedSecret) {
    console.warn(`[TTN-WEBHOOK] ${requestId} | No webhook secret provided`);
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Missing webhook secret' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Look up organization by webhook secret
  const orgLookup = await lookupOrgByWebhookSecret(supabase, providedSecret);
  
  if (!orgLookup) {
    console.warn(`[TTN-WEBHOOK] ${requestId} | Invalid webhook secret - no matching org found`);
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Invalid webhook secret' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authenticatedOrgId = orgLookup.organizationId;
  const authenticatedAppId = orgLookup.applicationId;
  console.log(`[TTN-WEBHOOK] ${requestId} | AUTH SUCCESS - Org: ${authenticatedOrgId}, App: ${authenticatedAppId}`);

  try {
    const payload = await req.json();
    
    // Handle non-uplink events
    if (!payload.uplink_message) {
      const eventType = payload.join_accept ? 'join_accept' : 
                        payload.downlink_ack ? 'downlink_ack' :
                        payload.downlink_nack ? 'downlink_nack' :
                        'unknown';
      
      console.log(`[TTN-WEBHOOK] ${requestId} | Non-uplink event: ${eventType}, org: ${authenticatedOrgId}`);
      return new Response(
        JSON.stringify({ accepted: true, processed: false, event_type: eventType }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ttnPayload = payload as TTNUplinkMessage;
    
    // Extract uplink data
    const deviceId = ttnPayload.end_device_ids?.device_id || '';
    const rawDevEui = ttnPayload.end_device_ids?.dev_eui || '';
    const applicationId = ttnPayload.end_device_ids?.application_ids?.application_id || '';
    const decoded = ttnPayload.uplink_message?.decoded_payload || {};
    const rxMeta = ttnPayload.uplink_message?.rx_metadata?.[0];
    const rssi = rxMeta?.rssi ?? rxMeta?.channel_rssi;
    const receivedAt = ttnPayload.uplink_message?.received_at || ttnPayload.received_at || new Date().toISOString();

    console.log(`[TTN-WEBHOOK] ${requestId} | Uplink: device=${deviceId}, dev_eui=${rawDevEui}, app=${applicationId}`);

    // Validate that the uplink comes from the expected TTN application
    if (authenticatedAppId && applicationId !== authenticatedAppId) {
      console.warn(`[TTN-WEBHOOK] ${requestId} | Application ID mismatch! Expected: ${authenticatedAppId}, Got: ${applicationId}`);
      // Log but still process - the webhook secret was valid
    }

    // Validate DevEUI
    if (!rawDevEui) {
      console.warn(`[TTN-WEBHOOK] ${requestId} | Missing dev_eui`);
      return new Response(
        JSON.stringify({ accepted: true, processed: false, reason: 'Missing dev_eui' }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedDevEui = normalizeDevEui(rawDevEui);
    if (!normalizedDevEui) {
      return new Response(
        JSON.stringify({ accepted: true, processed: false, reason: 'Invalid dev_eui format' }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate match variants
    const devEuiLower = normalizedDevEui;
    const devEuiUpper = normalizedDevEui.toUpperCase();
    const devEuiColonUpper = formatDevEuiForDisplay(normalizedDevEui);
    const devEuiColonLower = devEuiColonUpper.toLowerCase();

    // ========================================
    // LOOKUP: Find sensor in authenticated org only
    // ========================================
    let loraSensor: LoraSensor | null = null;

    // Try by ttn_device_id first
    if (deviceId) {
      const { data: sensorByDeviceId } = await supabase
        .from('lora_sensors')
        .select('id, organization_id, site_id, unit_id, dev_eui, status, ttn_application_id, sensor_type, name, is_primary, model')
        .eq('ttn_device_id', deviceId)
        .eq('organization_id', authenticatedOrgId)  // CRITICAL: Scope to authenticated org
        .maybeSingle();

      if (sensorByDeviceId) {
        console.log(`[TTN-WEBHOOK] ${requestId} | Found sensor by ttn_device_id: ${sensorByDeviceId.name}`);
        loraSensor = sensorByDeviceId;
      }
    }

    // Fallback to dev_eui
    if (!loraSensor) {
      const { data: sensorByDevEui } = await supabase
        .from('lora_sensors')
        .select('id, organization_id, site_id, unit_id, dev_eui, status, ttn_application_id, sensor_type, name, is_primary, model')
        .or(`dev_eui.eq.${devEuiLower},dev_eui.eq.${devEuiUpper},dev_eui.eq.${devEuiColonUpper},dev_eui.eq.${devEuiColonLower}`)
        .eq('organization_id', authenticatedOrgId)  // CRITICAL: Scope to authenticated org
        .maybeSingle();

      if (sensorByDevEui) {
        console.log(`[TTN-WEBHOOK] ${requestId} | Found sensor by dev_eui: ${sensorByDevEui.name}`);
        loraSensor = sensorByDevEui;
      }
    }

    // Process lora sensor
    if (loraSensor) {
      return await handleLoraSensor(supabase, loraSensor, {
        devEui: devEuiLower,
        deviceId,
        applicationId,
        decoded,
        rssi,
        receivedAt,
        requestId,
      });
    }

    // Legacy fallback - also scope to org if possible
    const { data: device } = await supabase
      .from('devices')
      .select('id, unit_id, status, organization_id')
      .or(`serial_number.eq.${devEuiLower},serial_number.eq.${devEuiUpper},serial_number.eq.${devEuiColonUpper},serial_number.eq.${devEuiColonLower}`)
      .eq('organization_id', authenticatedOrgId)
      .maybeSingle();

    if (device) {
      return await handleLegacyDevice(supabase, device, {
        devEui: devEuiLower,
        deviceId,
        decoded,
        rssi,
        receivedAt,
        requestId,
      });
    }

    // Unknown device
    console.warn(`[TTN-WEBHOOK] ${requestId} | Unknown device for org ${authenticatedOrgId}: ${devEuiLower}`);
    return new Response(
      JSON.stringify({ 
        accepted: true,
        processed: false,
        reason: 'Unknown device - not registered for this organization',
        dev_eui: devEuiLower,
        organization_id: authenticatedOrgId,
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error(`[TTN-WEBHOOK] ${requestId} | Error:`, error);
    return new Response(
      JSON.stringify({ accepted: true, processed: false, error: 'Processing error' }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle uplink from a LoRa sensor
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
    requestId: string;
  }
): Promise<Response> {
  const { devEui, decoded, rssi, receivedAt, requestId } = data;
  
  // Battery handling
  const battery = (decoded.battery ?? decoded.battery_level) as number | undefined;

  // Temperature scaling
  let temperature = decoded.temperature as number | undefined;
  if (temperature !== undefined) {
    const tempScale = (decoded.temperature_scale ?? 1) as number;
    if (tempScale !== 1) {
      temperature = temperature * tempScale;
    } else if (temperature > 0 && temperature < 10) {
      const scaledTemp = temperature * 10;
      if (scaledTemp >= 10 && scaledTemp <= 100) {
        temperature = scaledTemp;
      }
    }
  }

  console.log(`[TTN-WEBHOOK] ${requestId} | Processing sensor: ${sensor.name}, temp: ${temperature ?? 'N/A'}`);

  // Update sensor status
  const sensorUpdate: Record<string, unknown> = {
    last_seen_at: receivedAt,
    updated_at: new Date().toISOString(),
  };

  if (sensor.status === 'pending' || sensor.status === 'joining') {
    sensorUpdate.status = 'active';
    if (sensor.status === 'joining') {
      sensorUpdate.last_join_at = receivedAt;
    }
  }

  if (battery !== undefined) sensorUpdate.battery_level = battery;
  if (rssi !== undefined) sensorUpdate.signal_strength = rssi;

  // ========================================
  // SELF-HEALING: Infer sensor_type from payload
  // If sensor was misclassified (e.g., defaulted to "temperature"),
  // correct it based on actual payload fields
  // ========================================
  const payloadInferredType = inferSensorTypeFromPayload(decoded);
  const currentType = sensor.sensor_type;

  // Only update if we can infer a type AND it's different from current
  // AND the current type is a likely default (temperature)
  if (payloadInferredType && payloadInferredType !== currentType) {
    // If current is "temperature" but payload shows it's a door sensor, fix it
    if (currentType === 'temperature' || !currentType) {
      sensorUpdate.sensor_type = payloadInferredType;
      console.log(`[TTN-WEBHOOK] ${requestId} | Correcting sensor type: ${currentType} -> ${payloadInferredType} (based on payload keys: ${Object.keys(decoded).join(', ')})`);
    }
  }

  // Also try to infer and set model if missing
  const payloadInferredModel = inferModelFromPayload(decoded);
  const nameInferredModel = extractModelFromUnitId(sensor.name);
  if (!sensor.model && (payloadInferredModel || nameInferredModel)) {
    const inferredModel = payloadInferredModel || nameInferredModel;
    sensorUpdate.model = inferredModel;
    console.log(`[TTN-WEBHOOK] ${requestId} | Setting model: ${inferredModel}`);
  }

  await supabase.from('lora_sensors').update(sensorUpdate).eq('id', sensor.id);

  // Handle unit-assigned sensors
  if (sensor.unit_id) {
    const hasTemperatureData = temperature !== undefined;
    
    // Normalize door data from various payload formats (door_status, door_open, open_close, etc.)
    const normalizedDoorOpen = normalizeDoorData(decoded);
    const hasDoorData = normalizedDoorOpen !== undefined;
    
    // Log door normalization for debugging
    if (hasDoorData) {
      const doorSource = getDoorFieldSource(decoded);
      console.log(`[TTN-WEBHOOK] ${requestId} | Door data normalized: ${normalizedDoorOpen} from ${doorSource}`);
    }

    if (!hasTemperatureData && !hasDoorData) {
      console.log(`[TTN-WEBHOOK] ${requestId} | No temp or door data in payload. Keys: ${Object.keys(decoded).join(', ')}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Sensor updated, no data to record', sensor_id: sensor.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: unit } = await supabase.from('units').select('door_state').eq('id', sensor.unit_id).single();
    const previousDoorState = unit?.door_state;
    const currentDoorOpen = normalizedDoorOpen;

    // Only include door_open if the sensor actually has door capability
    // This prevents temperature sensors from polluting door data
    // hasDoorData already confirms normalized door data exists
    const hasDoorCapability = hasDoorData || 
      sensor.sensor_type === 'door' || 
      sensor.sensor_type === 'combo';

    // Build reading data - only include door_open for door-capable sensors
    const readingData: Record<string, unknown> = {
      unit_id: sensor.unit_id,
      lora_sensor_id: sensor.id,
      device_id: null,
      temperature: temperature ?? null,
      humidity: decoded.humidity,
      battery_level: battery,
      signal_strength: rssi,
      source: 'ttn',
      recorded_at: receivedAt,
    };

    // Only set door_open if this is actually a door sensor
    if (hasDoorCapability && currentDoorOpen !== undefined) {
      readingData.door_open = currentDoorOpen;
    }

    // Insert reading
    const { data: insertedReading, error: insertError } = await supabase
      .from('sensor_readings')
      .insert(readingData)
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Update unit
    const unitUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (sensor.is_primary && hasTemperatureData) {
      unitUpdate.last_temp_reading = temperature;
      unitUpdate.last_reading_at = receivedAt;
      unitUpdate.last_checkin_at = receivedAt;
      unitUpdate.sensor_reliable = true;
    } else if (hasTemperatureData) {
      unitUpdate.last_checkin_at = receivedAt;
    }

    // Only process door state if sensor has door capability
    if (hasDoorCapability && currentDoorOpen !== undefined) {
      unitUpdate.door_state = currentDoorOpen ? 'open' : 'closed';
      unitUpdate.door_state_changed_at = receivedAt;

      if (currentDoorOpen && previousDoorState !== 'open') {
        unitUpdate.door_open_since = receivedAt;
      } else if (!currentDoorOpen && previousDoorState === 'open') {
        unitUpdate.door_open_since = null;
      }

      // Insert door event - including initial readings to establish baseline
      const newDoorState = currentDoorOpen ? 'open' : 'closed';
      const isInitialReading = previousDoorState === 'unknown' || previousDoorState === null || previousDoorState === undefined;
      const stateChanged = previousDoorState !== newDoorState;

      if (isInitialReading || stateChanged) {
        await supabase.from('door_events').insert({
          unit_id: sensor.unit_id,
          state: newDoorState,
          occurred_at: receivedAt,
          source: 'ttn',
          metadata: { 
            sensor_id: sensor.id, 
            sensor_name: sensor.name,
            is_initial: isInitialReading,
          },
        });
        console.log(`[TTN-WEBHOOK] ${requestId} | Door event: ${previousDoorState} -> ${newDoorState} (initial: ${isInitialReading})`);
      }
    }

    await supabase.from('units').update(unitUpdate).eq('id', sensor.unit_id);

    return new Response(
      JSON.stringify({
        success: true,
        sensor_id: sensor.id,
        reading_id: insertedReading?.id,
        temperature,
        unit_id: sensor.unit_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Sensor not assigned to unit
  return new Response(
    JSON.stringify({ success: true, message: 'Sensor updated (not assigned to unit)', sensor_id: sensor.id }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Handle uplink from a legacy device
 */
async function handleLegacyDevice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  device: LegacyDevice,
  data: {
    devEui: string;
    deviceId: string;
    decoded: Record<string, unknown>;
    rssi: number | undefined;
    receivedAt: string;
    requestId: string;
  }
): Promise<Response> {
  const { decoded, rssi, receivedAt, requestId } = data;
  
  const battery = (decoded.battery ?? decoded.battery_level) as number | undefined;
  let temperature = decoded.temperature as number | undefined;
  
  if (temperature !== undefined && temperature > 0 && temperature < 10) {
    const scaledTemp = temperature * 10;
    if (scaledTemp >= 10 && scaledTemp <= 100) {
      temperature = scaledTemp;
    }
  }

  console.log(`[TTN-WEBHOOK] ${requestId} | Processing legacy device: ${device.id}`);

  // Update device
  const deviceUpdate: Record<string, unknown> = {
    last_seen_at: receivedAt,
    updated_at: new Date().toISOString(),
    status: 'active',
  };
  if (battery !== undefined) deviceUpdate.battery_level = battery;
  if (rssi !== undefined) deviceUpdate.signal_strength = rssi;

  await supabase.from('devices').update(deviceUpdate).eq('id', device.id);

  if (device.unit_id && temperature !== undefined) {
    await supabase.from('sensor_readings').insert({
      unit_id: device.unit_id,
      device_id: device.id,
      temperature,
      humidity: decoded.humidity,
      battery_level: battery,
      signal_strength: rssi,
      door_open: decoded.door_open,
      source: 'ttn',
      recorded_at: receivedAt,
    });

    await supabase.from('units').update({
      last_temp_reading: temperature,
      last_reading_at: receivedAt,
      last_checkin_at: receivedAt,
      updated_at: new Date().toISOString(),
    }).eq('id', device.unit_id);
  }

  return new Response(
    JSON.stringify({ success: true, device_id: device.id }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
