import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SimulatorAction = 
  | "pair_sensor"
  | "unpair_sensor"
  | "set_online"
  | "set_offline"
  | "update_telemetry"
  | "set_door_state"
  | "inject"
  | "start_streaming"
  | "stop_streaming"
  | "reset"
  | "start" // Legacy - maps to pair + online + inject batch
  | "stop"; // Legacy - maps to set_offline

interface SimulatorRequest {
  action: SimulatorAction;
  unit_id: string;
  // For inject/streaming
  temperature?: number;
  humidity?: number;
  // Telemetry
  battery_level?: number;
  signal_strength?: number;
  // Door
  door_state?: "open" | "closed";
  door_sensor_present?: boolean;
  // Streaming
  interval_seconds?: number;
  // Door cycle
  door_cycle_enabled?: boolean;
  door_cycle_open_seconds?: number;
  door_cycle_closed_seconds?: number;
}

interface SimulatedDeviceConfig {
  id: string;
  unit_id: string;
  organization_id: string;
  device_id: string | null;
  is_active: boolean;
  sensor_paired: boolean;
  sensor_online: boolean;
  door_sensor_present: boolean;
  battery_level: number;
  signal_strength: number;
  current_temperature: number;
  current_humidity: number;
  door_state: string;
  door_open_since: string | null;
  streaming_enabled: boolean;
  streaming_interval_seconds: number;
  last_heartbeat_at: string | null;
  next_reading_at: string | null;
  door_cycle_enabled: boolean;
  door_cycle_open_seconds: number;
  door_cycle_closed_seconds: number;
  door_cycle_next_change_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let organizationId: string | null = null;

    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;

        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.organization_id) {
          organizationId = profile.organization_id;

          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("organization_id", profile.organization_id)
            .maybeSingle();

          if (!roleData || !["owner", "admin"].includes(roleData.role)) {
            return new Response(
              JSON.stringify({ error: "Admin access required" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    const body: SimulatorRequest = await req.json();
    const { action, unit_id } = body;

    console.log(`[sensor-simulator] Action: ${action} for unit ${unit_id}`);

    // Get unit details
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select(`
        id, name, unit_type, temp_limit_high, temp_limit_low, door_state,
        area:areas!inner(site:sites!inner(organization_id))
      `)
      .eq("id", unit_id)
      .maybeSingle();

    if (unitError || !unit) {
      return new Response(
        JSON.stringify({ error: "Unit not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const unitData = unit as any;
    const unitOrgId = unitData.area.site.organization_id;
    
    // CRITICAL: Cross-org validation - if user is authenticated, verify they own this unit
    if (organizationId && unitOrgId !== organizationId) {
      return new Response(
        JSON.stringify({ error: "Cannot access units from another organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Set org from unit if not authenticated (e.g., cron job)
    if (!organizationId) {
      organizationId = unitOrgId;
    }

    // Get or create simulated device config
    let { data: simConfig } = await supabase
      .from("simulated_devices")
      .select("*")
      .eq("unit_id", unit_id)
      .maybeSingle();

    let result: any = {};

    switch (action) {
      case "pair_sensor": {
        const serialNumber = `SIM-${unit_id.slice(0, 8).toUpperCase()}`;
        
        // Create device record
        const { data: device, error: deviceError } = await supabase
          .from("devices")
          .insert({
            serial_number: serialNumber,
            unit_id: unit_id,
            status: "inactive",
            transmit_interval: 60,
          })
          .select()
          .single();

        if (deviceError) {
          // Device might already exist
          const { data: existingDevice } = await supabase
            .from("devices")
            .select("*")
            .eq("serial_number", serialNumber)
            .maybeSingle();
          
          if (!existingDevice) throw deviceError;
          result.device = existingDevice;
        } else {
          result.device = device;
        }

        // Create or update simulated_devices config
        const configData = {
          unit_id,
          organization_id: organizationId!,
          device_id: result.device.id,
          is_active: true,
          sensor_paired: true,
          sensor_online: false,
          battery_level: body.battery_level ?? 100,
          signal_strength: body.signal_strength ?? -50,
          current_temperature: generateNormalTemp(unitData.temp_limit_high, unitData.temp_limit_low),
          created_by: userId,
        };

        if (simConfig) {
          await supabase
            .from("simulated_devices")
            .update({ ...configData, sensor_paired: true, device_id: result.device.id })
            .eq("id", simConfig.id);
        } else {
          const { data: newConfig } = await supabase
            .from("simulated_devices")
            .insert(configData)
            .select()
            .single();
          simConfig = newConfig;
        }

        result.message = `Sensor paired with serial ${serialNumber}`;
        result.serial_number = serialNumber;
        
        await logEvent(supabase, organizationId!, unit_id, userId, "pair_sensor", { serial_number: serialNumber });
        break;
      }

      case "unpair_sensor": {
        if (simConfig?.device_id) {
          // Delete device
          await supabase.from("devices").delete().eq("id", simConfig.device_id);
        }
        
        // Delete simulated_devices config
        if (simConfig) {
          await supabase.from("simulated_devices").delete().eq("id", simConfig.id);
        }

        result.message = "Sensor unpaired - unit reset to 'Not Paired' state";
        await logEvent(supabase, organizationId!, unit_id, userId, "unpair_sensor", {});
        break;
      }

      case "set_online": {
        if (!simConfig || !simConfig.sensor_paired) {
          return new Response(
            JSON.stringify({ error: "Sensor must be paired first" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const now = new Date().toISOString();
        
        // Update device as active
        if (simConfig.device_id) {
          await supabase.from("devices").update({
            status: "active",
            last_seen_at: now,
          }).eq("id", simConfig.device_id);
        }

        // Update simulated config
        await supabase.from("simulated_devices").update({
          sensor_online: true,
          last_heartbeat_at: now,
        }).eq("id", simConfig.id);

        // Inject initial reading to make unit appear online
        await injectReading(supabase, simConfig as SimulatedDeviceConfig, unitData);

        result.message = "Sensor online - heartbeat started";
        await logEvent(supabase, organizationId!, unit_id, userId, "set_online", {});
        
        // Trigger alert evaluation
        await triggerAlertEvaluation(supabase);
        break;
      }

      case "set_offline": {
        if (!simConfig) {
          return new Response(
            JSON.stringify({ error: "No simulation config found" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update device as inactive
        if (simConfig.device_id) {
          await supabase.from("devices").update({
            status: "inactive",
          }).eq("id", simConfig.device_id);
        }

        // Update simulated config
        await supabase.from("simulated_devices").update({
          sensor_online: false,
          streaming_enabled: false,
        }).eq("id", simConfig.id);

        // Set last reading to old time to trigger offline detection
        const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        await supabase.from("units").update({
          last_reading_at: oldTime,
        }).eq("id", unit_id);

        result.message = "Sensor offline - will trigger monitoring_interrupted alert";
        await logEvent(supabase, organizationId!, unit_id, userId, "set_offline", {});
        
        await triggerAlertEvaluation(supabase);
        break;
      }

      case "update_telemetry": {
        if (!simConfig) {
          return new Response(
            JSON.stringify({ error: "No simulation config found" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updates: Partial<SimulatedDeviceConfig> = {};
        if (body.battery_level !== undefined) updates.battery_level = body.battery_level;
        if (body.signal_strength !== undefined) updates.signal_strength = body.signal_strength;
        if (body.door_sensor_present !== undefined) updates.door_sensor_present = body.door_sensor_present;

        await supabase.from("simulated_devices").update(updates).eq("id", simConfig.id);

        // If online, inject a reading with new telemetry
        if (simConfig.sensor_online) {
          const updatedConfig = { ...simConfig, ...updates } as SimulatedDeviceConfig;
          await injectReading(supabase, updatedConfig, unitData);
        }

        result.message = "Telemetry updated";
        result.updates = updates;
        await logEvent(supabase, organizationId!, unit_id, userId, "update_telemetry", updates);
        break;
      }

      case "set_door_state": {
        if (!simConfig) {
          return new Response(
            JSON.stringify({ error: "No simulation config found" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const newDoorState = body.door_state || "closed";
        const now = new Date().toISOString();
        const requestId = crypto.randomUUID().slice(0, 8);
        
        // STEP A: Log set_door_state action
        console.log(`[sensor-simulator] set_door_state action:`, {
          requestId,
          unitId: unit_id,
          previousState: unitData?.door_state,
          newState: newDoorState,
          source: 'emulator'
        });
        
        const updates: any = {
          door_state: newDoorState,
          door_sensor_present: true,
        };
        
        if (newDoorState === "open") {
          updates.door_open_since = now;
        } else {
          updates.door_open_since = null;
        }

        await supabase.from("simulated_devices").update(updates).eq("id", simConfig.id);

        // Inject reading with door state
        if (simConfig.sensor_online || simConfig.sensor_paired) {
          const updatedConfig = { ...simConfig, ...updates } as SimulatedDeviceConfig;
          await injectReading(supabase, updatedConfig, unitData, true, requestId);
        }

        result.message = `Door set to ${newDoorState}`;
        await logEvent(supabase, organizationId!, unit_id, userId, "set_door_state", { door_state: newDoorState });
        
        await triggerAlertEvaluation(supabase);
        break;
      }

      case "inject": {
        if (!simConfig) {
          // Create a quick config for injection
          const { data: newConfig } = await supabase
            .from("simulated_devices")
            .insert({
              unit_id,
              organization_id: organizationId!,
              is_active: true,
              sensor_paired: true,
              sensor_online: true,
              current_temperature: body.temperature ?? generateNormalTemp(unitData.temp_limit_high, unitData.temp_limit_low),
              created_by: userId,
            })
            .select()
            .single();
          simConfig = newConfig;
        }

        // Update temperature if provided
        if (body.temperature !== undefined) {
          await supabase.from("simulated_devices").update({
            current_temperature: body.temperature,
          }).eq("id", simConfig.id);
          simConfig.current_temperature = body.temperature;
        }

        if (body.humidity !== undefined) {
          await supabase.from("simulated_devices").update({
            current_humidity: body.humidity,
          }).eq("id", simConfig.id);
          simConfig.current_humidity = body.humidity;
        }

        await injectReading(supabase, simConfig as SimulatedDeviceConfig, unitData);

        result.message = `Reading injected: ${simConfig.current_temperature}°F`;
        result.temperature = simConfig.current_temperature;
        await logEvent(supabase, organizationId!, unit_id, userId, "inject", { temperature: simConfig.current_temperature });
        
        await triggerAlertEvaluation(supabase);
        break;
      }

      case "start_streaming": {
        if (!simConfig || !simConfig.sensor_paired) {
          return new Response(
            JSON.stringify({ error: "Sensor must be paired first" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const interval = body.interval_seconds ?? 60;
        const nextReading = new Date(Date.now() + interval * 1000).toISOString();

        await supabase.from("simulated_devices").update({
          streaming_enabled: true,
          streaming_interval_seconds: interval,
          sensor_online: true,
          next_reading_at: nextReading,
        }).eq("id", simConfig.id);

        // Set device online
        if (simConfig.device_id) {
          await supabase.from("devices").update({
            status: "active",
            last_seen_at: new Date().toISOString(),
          }).eq("id", simConfig.device_id);
        }

        // Inject first reading immediately
        await injectReading(supabase, { ...simConfig, streaming_enabled: true, sensor_online: true } as SimulatedDeviceConfig, unitData);

        result.message = `Streaming started - readings every ${interval}s`;
        result.interval_seconds = interval;
        await logEvent(supabase, organizationId!, unit_id, userId, "start_streaming", { interval_seconds: interval });
        break;
      }

      case "stop_streaming": {
        if (!simConfig) {
          return new Response(
            JSON.stringify({ error: "No simulation config found" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase.from("simulated_devices").update({
          streaming_enabled: false,
          next_reading_at: null,
        }).eq("id", simConfig.id);

        result.message = "Streaming stopped";
        await logEvent(supabase, organizationId!, unit_id, userId, "stop_streaming", {});
        break;
      }

      case "reset": {
        // Full reset - remove all simulation data
        if (simConfig?.device_id) {
          await supabase.from("devices").delete().eq("id", simConfig.device_id);
        }
        if (simConfig) {
          await supabase.from("simulated_devices").delete().eq("id", simConfig.id);
        }

        // Clear unit's simulated readings
        await supabase.from("units").update({
          last_reading_at: null,
          last_temp_reading: null,
          door_state: "unknown",
        }).eq("id", unit_id);

        result.message = "Simulation reset - unit returned to 'Not Paired' state";
        await logEvent(supabase, organizationId!, unit_id, userId, "reset", {});
        
        await triggerAlertEvaluation(supabase);
        break;
      }

      // Legacy actions for backwards compatibility
      case "start": {
        // Pair + set online + inject batch of readings
        const serialNumber = `SIM-${unit_id.slice(0, 8).toUpperCase()}`;
        
        // Create or get device
        let deviceId: string | null = null;
        const { data: existingDevice } = await supabase
          .from("devices")
          .select("id")
          .eq("serial_number", serialNumber)
          .maybeSingle();

        if (existingDevice) {
          deviceId = existingDevice.id;
        } else {
          const { data: newDevice } = await supabase
            .from("devices")
            .insert({
              serial_number: serialNumber,
              unit_id,
              status: "active",
              transmit_interval: 60,
              last_seen_at: new Date().toISOString(),
            })
            .select()
            .single();
          deviceId = newDevice?.id;
        }

        // Create or update config
        const configData = {
          unit_id,
          organization_id: organizationId!,
          device_id: deviceId,
          is_active: true,
          sensor_paired: true,
          sensor_online: true,
          streaming_enabled: false,
          created_by: userId,
        };

        if (simConfig) {
          await supabase.from("simulated_devices").update(configData).eq("id", simConfig.id);
          simConfig = { ...simConfig, ...configData };
        } else {
          const { data: newConfig } = await supabase
            .from("simulated_devices")
            .insert(configData)
            .select()
            .single();
          simConfig = newConfig;
        }

        // Inject batch of readings
        const readings = [];
        const now = Date.now();
        const intervalSeconds = body.interval_seconds ?? 60;
        
        for (let i = 0; i < 5; i++) {
          const temp = generateNormalTemp(unitData.temp_limit_high, unitData.temp_limit_low);
          const timestamp = new Date(now - (4 - i) * intervalSeconds * 1000);
          
          readings.push({
            unit_id,
            device_id: deviceId,
            temperature: temp,
            humidity: Math.floor(Math.random() * 30 + 40),
            door_open: false,
            battery_level: 85 + Math.floor(Math.random() * 15),
            signal_strength: -50 - Math.floor(Math.random() * 30),
            recorded_at: timestamp.toISOString(),
            received_at: timestamp.toISOString(),
            source: "simulator",
          });
        }

        await supabase.from("sensor_readings").insert(readings);

        const lastTemp = readings[readings.length - 1].temperature;
        await supabase.from("units").update({
          last_temp_reading: lastTemp,
          last_reading_at: new Date().toISOString(),
          status: "ok",
        }).eq("id", unit_id);

        result = { 
          message: "Simulation started - 5 readings injected", 
          readings: readings.length,
          last_temperature: lastTemp,
          serial_number: serialNumber,
        };

        await logEvent(supabase, organizationId!, unit_id, userId, "start", { readings_count: readings.length });
        await triggerAlertEvaluation(supabase);
        break;
      }

      case "stop": {
        // Legacy stop - set offline
        if (simConfig) {
          await supabase.from("simulated_devices").update({
            sensor_online: false,
            streaming_enabled: false,
          }).eq("id", simConfig.id);

          if (simConfig.device_id) {
            await supabase.from("devices").update({ status: "inactive" }).eq("id", simConfig.device_id);
          }
        }

        const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        await supabase.from("units").update({
          last_reading_at: oldTime,
        }).eq("id", unit_id);

        result = { 
          message: "Simulation stopped - data gap will be detected",
          last_reading_at: oldTime,
        };

        await logEvent(supabase, organizationId!, unit_id, userId, "stop", {});
        await triggerAlertEvaluation(supabase);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Fetch updated config to return
    const { data: finalConfig } = await supabase
      .from("simulated_devices")
      .select("*")
      .eq("unit_id", unit_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({ success: true, ...result, config: finalConfig }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[sensor-simulator] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function injectReading(
  supabase: any, 
  config: SimulatedDeviceConfig, 
  unitData: any,
  forceDoorUpdate = false,
  requestId?: string
): Promise<void> {
  const now = new Date().toISOString();
  
  // Look up device serial if we have device_id
  let deviceSerial: string | null = null;
  if (config.device_id) {
    const { data: device } = await supabase
      .from("devices")
      .select("serial_number")
      .eq("id", config.device_id)
      .maybeSingle();
    deviceSerial = device?.serial_number;
  }

  // Insert reading via direct insert (same as ingest-readings does)
  const reading = {
    unit_id: config.unit_id,
    device_id: config.device_id,
    temperature: config.current_temperature,
    humidity: config.current_humidity,
    battery_level: config.battery_level,
    signal_strength: config.signal_strength,
    door_open: config.door_sensor_present ? config.door_state === "open" : null,
    source: "simulator",
    recorded_at: now,
    received_at: now,
  };

  await supabase.from("sensor_readings").insert(reading);

  // Update unit with reading and reliability tracking
  const { data: currentUnit } = await supabase
    .from("units")
    .select("last_checkin_at, consecutive_checkins")
    .eq("id", config.unit_id)
    .maybeSingle();

  const lastCheckin = currentUnit?.last_checkin_at ? new Date(currentUnit.last_checkin_at) : null;
  const nowTime = new Date(now);
  
  // Calculate consecutive check-ins (5-minute expected interval with 2.5x buffer)
  const expectedIntervalMs = 300 * 1000; // 5 minutes
  const threshold = expectedIntervalMs * 2.5;
  
  let newConsecutive = 1;
  if (lastCheckin) {
    const gap = nowTime.getTime() - lastCheckin.getTime();
    if (gap <= threshold && gap > 0) {
      newConsecutive = (currentUnit?.consecutive_checkins || 0) + 1;
    }
  }
  
  const sensorReliable = newConsecutive >= 2;

  const unitUpdate: any = {
    last_temp_reading: config.current_temperature,
    last_reading_at: now,
    last_checkin_at: now,
    consecutive_checkins: newConsecutive,
    sensor_reliable: sensorReliable,
    status: "ok", // Mark unit as OK when receiving valid readings
  };

  if (config.door_sensor_present || forceDoorUpdate) {
    unitUpdate.door_state = config.door_state;
    unitUpdate.door_last_changed_at = now;
  }

  const { error: unitUpdateError } = await supabase.from("units").update(unitUpdate).eq("id", config.unit_id);
  
  // STEP A: Log units UPDATE
  console.log(`[sensor-simulator] units UPDATE:`, {
    unitId: config.unit_id,
    door_state_written: unitUpdate.door_state,
    door_last_changed_at_written: unitUpdate.door_last_changed_at,
    error: unitUpdateError?.message || null
  });

  // Update device last seen and signal strength
  if (config.device_id) {
    await supabase.from("devices").update({
      last_seen_at: now,
      battery_level: config.battery_level,
      signal_strength: config.signal_strength,
      status: "active",
    }).eq("id", config.device_id);
  }

  // Update heartbeat in simulated config
  await supabase.from("simulated_devices").update({
    last_heartbeat_at: now,
  }).eq("id", config.id);

  // STEP B: ALWAYS insert door_event for emulator actions (deterministic for testing)
  // Mark same_state=true if no actual change occurred
  if (config.door_sensor_present) {
    const currentDoorState = unitData.door_state || "unknown";
    const sameState = config.door_state === currentDoorState;
    
    const { data: insertedEvent, error: doorError } = await supabase.from("door_events").insert({
      unit_id: config.unit_id,
      state: config.door_state,
      occurred_at: now,
      source: "simulator",
      metadata: { 
        temperature: config.current_temperature, 
        simulated: true,
        same_state: sameState  // Flag for same-state events
      },
    }).select('id').single();
    
    // STEP A: Log door_event INSERT
    console.log(`[sensor-simulator] door_event INSERT:`, {
      insertedEventId: insertedEvent?.id,
      unitId: config.unit_id,
      prevState: currentDoorState,
      newState: config.door_state,
      sameState,
      error: doorError?.message || null
    });
  }

  console.log(`[sensor-simulator] Injected reading: unit=${config.unit_id}, temp=${config.current_temperature}°F, door=${config.door_state}`);
}

async function logEvent(
  supabase: any,
  orgId: string,
  unitId: string,
  userId: string | null,
  action: string,
  data: Record<string, unknown>
): Promise<void> {
  await supabase.from("event_logs").insert({
    organization_id: orgId,
    unit_id: unitId,
    event_type: "sensor_simulation",
    actor_id: userId,
    actor_type: userId ? "user" : "system",
    event_data: { action, ...data, simulated: true },
  });
}

async function triggerAlertEvaluation(supabase: any): Promise<void> {
  try {
    console.log("[sensor-simulator] Triggering process-unit-states...");
    await supabase.functions.invoke("process-unit-states");
  } catch (error) {
    console.error("[sensor-simulator] Error triggering alert evaluation:", error);
  }
}

function generateNormalTemp(highLimit: number, lowLimit: number | null): number {
  const isFreeze = lowLimit !== null && lowLimit < 10;
  
  if (isFreeze) {
    return Math.round((-5 + Math.random() * 3) * 10) / 10;
  } else {
    return Math.round((35 + Math.random() * 3) * 10) / 10;
  }
}
