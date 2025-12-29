import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Scheduled function that processes streaming simulations and door cycles.
 * Should be called every minute via pg_cron or external scheduler.
 * 
 * This function:
 * 1. Finds all active streaming simulations
 * 2. Injects readings for units where next_reading_at has passed
 * 3. Processes door cycle state changes
 * 4. Updates next_reading_at and next door change times
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const nowIso = now.toISOString();

    console.log(`[run-simulator-heartbeats] Processing at ${nowIso}`);

    // Find all streaming simulations due for a reading
    const { data: dueSimulations, error: fetchError } = await supabase
      .from("simulated_devices")
      .select(`
        *,
        unit:units(id, name, unit_type, temp_limit_high, temp_limit_low, door_state)
      `)
      .eq("streaming_enabled", true)
      .eq("sensor_online", true)
      .lte("next_reading_at", nowIso);

    if (fetchError) {
      console.error("[run-simulator-heartbeats] Error fetching simulations:", fetchError);
      throw fetchError;
    }

    console.log(`[run-simulator-heartbeats] Found ${dueSimulations?.length || 0} simulations due for readings`);

    let readingsInjected = 0;
    let doorChanges = 0;

    for (const sim of dueSimulations || []) {
      try {
        // Process door cycle if enabled
        if (sim.door_cycle_enabled && sim.door_cycle_next_change_at) {
          const doorChangeTime = new Date(sim.door_cycle_next_change_at);
          if (doorChangeTime <= now) {
            // Toggle door state
            const newDoorState = sim.door_state === "open" ? "closed" : "open";
            const cycleSeconds = newDoorState === "open" 
              ? sim.door_cycle_open_seconds 
              : sim.door_cycle_closed_seconds;
            const nextDoorChange = new Date(now.getTime() + cycleSeconds * 1000);

            await supabase.from("simulated_devices").update({
              door_state: newDoorState,
              door_open_since: newDoorState === "open" ? nowIso : null,
              door_cycle_next_change_at: nextDoorChange.toISOString(),
            }).eq("id", sim.id);

            sim.door_state = newDoorState;
            doorChanges++;
            console.log(`[run-simulator-heartbeats] Door cycle: ${sim.unit?.name} -> ${newDoorState}`);
          }
        }

        // Inject reading
        const reading = {
          unit_id: sim.unit_id,
          device_id: sim.device_id,
          temperature: sim.current_temperature,
          humidity: sim.current_humidity,
          battery_level: sim.battery_level,
          signal_strength: sim.signal_strength,
          door_open: sim.door_sensor_present ? sim.door_state === "open" : null,
          source: "simulator",
          recorded_at: nowIso,
          received_at: nowIso,
        };

        await supabase.from("sensor_readings").insert(reading);

        // Update unit - mark as OK when receiving valid readings
        const unitUpdate: any = {
          last_temp_reading: sim.current_temperature,
          last_reading_at: nowIso,
          last_checkin_at: nowIso,
          status: "ok",
          consecutive_checkins: 1,
          sensor_reliable: true,
        };

        if (sim.door_sensor_present) {
          unitUpdate.door_state = sim.door_state;
        }

        await supabase.from("units").update(unitUpdate).eq("id", sim.unit_id);

        // Update device last seen
        if (sim.device_id) {
          await supabase.from("devices").update({
            last_seen_at: nowIso,
            battery_level: sim.battery_level,
          }).eq("id", sim.device_id);
        }

        // Calculate next reading time
        const nextReading = new Date(now.getTime() + sim.streaming_interval_seconds * 1000);
        
        await supabase.from("simulated_devices").update({
          last_heartbeat_at: nowIso,
          next_reading_at: nextReading.toISOString(),
        }).eq("id", sim.id);

        readingsInjected++;
        console.log(`[run-simulator-heartbeats] Injected reading for ${sim.unit?.name}: ${sim.current_temperature}°F`);

      } catch (simError) {
        console.error(`[run-simulator-heartbeats] Error processing sim ${sim.id}:`, simError);
      }
    }

    // Process door cycles for non-streaming but cycling simulations
    const { data: doorCycleOnly } = await supabase
      .from("simulated_devices")
      .select("*")
      .eq("door_cycle_enabled", true)
      .eq("streaming_enabled", false)
      .lte("door_cycle_next_change_at", nowIso);

    for (const sim of doorCycleOnly || []) {
      try {
        const newDoorState = sim.door_state === "open" ? "closed" : "open";
        const cycleSeconds = newDoorState === "open" 
          ? sim.door_cycle_open_seconds 
          : sim.door_cycle_closed_seconds;
        const nextDoorChange = new Date(now.getTime() + cycleSeconds * 1000);

        await supabase.from("simulated_devices").update({
          door_state: newDoorState,
          door_open_since: newDoorState === "open" ? nowIso : null,
          door_cycle_next_change_at: nextDoorChange.toISOString(),
        }).eq("id", sim.id);

        // Update unit door state
        await supabase.from("units").update({
          door_state: newDoorState,
          door_last_changed_at: nowIso,
        }).eq("id", sim.unit_id);

        // Insert door event
        await supabase.from("door_events").insert({
          unit_id: sim.unit_id,
          state: newDoorState,
          occurred_at: nowIso,
          source: "simulator",
          metadata: { door_cycle: true },
        });

        doorChanges++;
      } catch (doorError) {
        console.error(`[run-simulator-heartbeats] Error processing door cycle ${sim.id}:`, doorError);
      }
    }

    // Trigger alert evaluation if any changes were made
    if (readingsInjected > 0 || doorChanges > 0) {
      try {
        await supabase.functions.invoke("process-unit-states");
        console.log("[run-simulator-heartbeats] Triggered process-unit-states");
      } catch (evalError) {
        console.error("[run-simulator-heartbeats] Error triggering alerts:", evalError);
      }
    }

    const result = {
      success: true,
      processed_at: nowIso,
      readings_injected: readingsInjected,
      door_changes: doorChanges,
    };

    console.log(`[run-simulator-heartbeats] Complete:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[run-simulator-heartbeats] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
