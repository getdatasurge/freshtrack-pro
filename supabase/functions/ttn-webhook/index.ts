/**
 * TTN Webhook Edge Function
 * 
 * Receives uplink messages from The Things Network and inserts sensor data.
 * Maps DevEUI to unit_id via the devices table (serial_number = dev_eui).
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
    const deviceId = payload.end_device_ids.device_id;
    const applicationId = payload.end_device_ids.application_ids?.application_id;
    
    // Extract decoded payload data
    const decoded = payload.uplink_message?.decoded_payload || {};
    const rxMeta = payload.uplink_message?.rx_metadata?.[0];
    const rssi = rxMeta?.rssi ?? rxMeta?.channel_rssi;
    const receivedAt = payload.uplink_message?.received_at || payload.received_at || new Date().toISOString();

    // Validate we have at least temperature data
    if (decoded.temperature === undefined) {
      console.log('No temperature in decoded payload, skipping insert');
      return new Response(
        JSON.stringify({ success: true, message: 'No temperature data, skipping' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up device by DevEUI (stored in serial_number)
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, unit_id, status')
      .or(`serial_number.eq.${devEui},serial_number.eq.${devEui.toUpperCase()}`)
      .maybeSingle();

    if (deviceError) {
      console.error('Database error looking up device:', deviceError);
      throw deviceError;
    }

    if (!device) {
      console.warn(`Unknown device with DevEUI: ${devEui}`);
      return new Response(
        JSON.stringify({ 
          error: 'Unknown device', 
          dev_eui: devEui,
          hint: 'Register device in Freshtrack Pro with serial_number = DevEUI'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!device.unit_id) {
      console.warn(`Device ${devEui} not linked to a unit`);
      return new Response(
        JSON.stringify({ 
          error: 'Device not linked to unit', 
          dev_eui: devEui,
          device_id: device.id,
          hint: 'Link this device to a unit in Freshtrack Pro'
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
    const currentDoorOpen = decoded.door_open;

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
      
      // Track door state change time
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
      
      // Check if state actually changed
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
          // Don't fail the whole request for door event errors
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
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
