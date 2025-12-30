/**
 * TTN Webhook Edge Function
 * 
 * Receives uplink messages from The Things Network and inserts sensor data.
 * 
 * Phase 5: Ownership Resolution
 * - Primary lookup via lora_sensors table (DevEUI → sensor → org)
 * - Validates TTN application_id matches sensor's ttn_application_id
 * - Rejects unknown EUIs (404) and cross-org attempts (403)
 * - Updates sensor status: pending/joining → active on first uplink
 * - Falls back to devices table for legacy BLE sensors
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-downlink-apikey',
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
      humidity?: number;
      battery?: number;
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
}

interface LegacyDevice {
  id: string;
  unit_id: string | null;
  status: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate webhook secret if configured
  const webhookSecret = Deno.env.get('TTN_WEBHOOK_API_KEY');
  if (webhookSecret) {
    const providedSecret = req.headers.get('X-Downlink-Apikey') || req.headers.get('X-Webhook-Secret');
    if (providedSecret !== webhookSecret) {
      console.warn('[SECURITY] Invalid or missing webhook secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Invalid webhook secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    const payload: TTNUplinkMessage = await req.json();
    
    console.log('Received TTN uplink:', JSON.stringify(payload, null, 2));

    // Validate required fields
    if (!payload.end_device_ids?.dev_eui) {
      console.error('Missing dev_eui in payload');
      return new Response(
        JSON.stringify({ error: 'Missing dev_eui in payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const devEui = payload.end_device_ids.dev_eui.toLowerCase();
    const devEuiUpper = payload.end_device_ids.dev_eui.toUpperCase();
    const deviceId = payload.end_device_ids.device_id;
    const applicationId = payload.end_device_ids.application_ids?.application_id;
    
    // Extract decoded payload data
    const decoded = payload.uplink_message?.decoded_payload || {};
    const rxMeta = payload.uplink_message?.rx_metadata?.[0];
    const rssi = rxMeta?.rssi ?? rxMeta?.channel_rssi;
    const receivedAt = payload.uplink_message?.received_at || payload.received_at || new Date().toISOString();

    // Initialize Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========================================
    // PRIMARY: Look up in lora_sensors table
    // ========================================
    const { data: loraSensor, error: sensorError } = await supabase
      .from('lora_sensors')
      .select('id, organization_id, site_id, unit_id, dev_eui, status, ttn_application_id, sensor_type, name')
      .or(`dev_eui.eq.${devEui},dev_eui.eq.${devEuiUpper}`)
      .maybeSingle();

    if (sensorError) {
      console.error('Database error looking up lora_sensor:', sensorError);
      throw sensorError;
    }

    // If found in lora_sensors, use new ownership model
    if (loraSensor) {
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
    // FALLBACK: Look up in devices table (legacy BLE)
    // ========================================
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, unit_id, status')
      .or(`serial_number.eq.${devEui},serial_number.eq.${devEuiUpper}`)
      .maybeSingle();

    if (deviceError) {
      console.error('Database error looking up device:', deviceError);
      throw deviceError;
    }

    if (device) {
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
    // ========================================
    console.warn(`[SECURITY] Unknown device with DevEUI: ${devEui}, application: ${applicationId}`);
    
    // Log unknown device attempt (to console only - event_logs requires org_id)
    console.log(JSON.stringify({
      event: 'ttn_unknown_device',
      severity: 'warn',
      dev_eui: devEui,
      application_id: applicationId,
      gateway_id: rxMeta?.gateway_ids?.gateway_id,
      rssi,
      received_at: receivedAt,
    }));

    return new Response(
      JSON.stringify({ 
        error: 'Unknown device', 
        dev_eui: devEui,
        quarantined: true,
        hint: 'Register this sensor in FrostGuard with the correct DevEUI'
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('TTN webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle uplink from a LoRa sensor (new ownership model)
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

  console.log(`Processing LoRa sensor: ${sensor.name} (${sensor.dev_eui}), org: ${sensor.organization_id}`);

  // ========================================
  // SECURITY: Validate ownership via TTN Application ID
  // ========================================
  if (sensor.ttn_application_id && sensor.ttn_application_id !== applicationId) {
    console.error(`[SECURITY VIOLATION] DevEUI ${devEui} received from wrong TTN application!`);
    console.error(`  Expected: ${sensor.ttn_application_id}`);
    console.error(`  Received: ${applicationId}`);
    console.error(`  Org ID: ${sensor.organization_id}`);
    
    return new Response(
      JSON.stringify({ 
        error: 'Application ID mismatch',
        quarantined: true,
        security_event: true,
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    console.log(`Sensor ${sensor.name} activated (${sensor.status} → active)`);
  }

  // Update telemetry fields
  if (decoded.battery !== undefined) {
    sensorUpdate.battery_level = decoded.battery;
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
  // ========================================
  if (sensor.unit_id) {
    // Validate we have temperature data for sensor readings
    if (decoded.temperature === undefined) {
      console.log(`No temperature in payload for sensor ${sensor.name}, skipping reading insert`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Sensor updated, no temperature data to record',
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

    // Insert sensor reading
    const { error: insertError } = await supabase
      .from('sensor_readings')
      .insert({
        unit_id: sensor.unit_id,
        device_id: null, // lora_sensors don't use devices table
        temperature: decoded.temperature,
        humidity: decoded.humidity,
        battery_level: decoded.battery,
        signal_strength: rssi,
        door_open: currentDoorOpen,
        source: 'ttn',
        recorded_at: receivedAt,
      });

    if (insertError) {
      console.error('Error inserting sensor reading:', insertError);
      throw insertError;
    }

    console.log(`Inserted sensor reading for unit ${sensor.unit_id}`);

    // Update unit with latest reading
    const unitUpdate: Record<string, unknown> = {
      last_temp_reading: decoded.temperature,
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
              organization_id: sensor.organization_id,
            }
          });

        if (doorEventError) {
          console.error('Error inserting door event:', doorEventError);
        } else {
          console.log(`Inserted door event: ${currentState} for unit ${sensor.unit_id}`);
        }
      }
    }

    console.log(`Successfully processed TTN uplink from ${devEui} for unit ${sensor.unit_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sensor_id: sensor.id,
        unit_id: sensor.unit_id,
        organization_id: sensor.organization_id,
        temperature: decoded.temperature,
        status: sensorUpdate.status || sensor.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } else {
    // ========================================
    // Handle unassigned sensors (update status only)
    // ========================================
    console.log(`Sensor ${sensor.name} (${devEui}) has no unit assigned - telemetry recorded on sensor only`);

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

  console.log(`Processing legacy device: ${devEui} (fallback to devices table)`);

  // Validate we have temperature data
  if (decoded.temperature === undefined) {
    console.log('No temperature in decoded payload, skipping insert');
    return new Response(
      JSON.stringify({ success: true, message: 'No temperature data, skipping' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!device.unit_id) {
    console.warn(`Device ${devEui} not linked to a unit`);
    return new Response(
      JSON.stringify({ 
        error: 'Device not linked to unit', 
        dev_eui: devEui,
        device_id: device.id,
        hint: 'Link this device to a unit in FrostGuard'
      }),
      { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

  // Insert sensor reading
  const { error: insertError } = await supabase
    .from('sensor_readings')
    .insert({
      unit_id: device.unit_id,
      device_id: device.id,
      temperature: decoded.temperature,
      humidity: decoded.humidity,
      battery_level: decoded.battery,
      signal_strength: rssi,
      door_open: currentDoorOpen,
      source: 'ttn',
      recorded_at: receivedAt,
    });

  if (insertError) {
    console.error('Error inserting sensor reading:', insertError);
    throw insertError;
  }

  console.log(`Inserted sensor reading for unit ${device.unit_id}`);

  // Update device status
  const deviceUpdate: Record<string, unknown> = {
    last_seen_at: receivedAt,
    status: 'active',
    updated_at: new Date().toISOString(),
  };
  
  if (decoded.battery !== undefined) {
    deviceUpdate.battery_level = decoded.battery;
    deviceUpdate.battery_last_reported_at = receivedAt;
  }
  if (rssi !== undefined) {
    deviceUpdate.signal_strength = rssi;
  }

  await supabase
    .from('devices')
    .update(deviceUpdate)
    .eq('id', device.id);

  // Update unit with latest reading info
  const unitUpdate: Record<string, unknown> = {
    last_temp_reading: decoded.temperature,
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
        console.error('Error inserting door event:', doorEventError);
      } else {
        console.log(`Inserted door event: ${currentState} for unit ${device.unit_id}`);
      }
    }
  }

  console.log(`Successfully processed TTN uplink from ${devEui} for unit ${device.unit_id}`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      unit_id: device.unit_id,
      device_id: device.id,
      temperature: decoded.temperature,
      legacy: true,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
