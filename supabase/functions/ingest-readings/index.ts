import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  ingestRequestSchema, 
  validateDeviceApiKey,
  validationErrorResponse,
  unauthorizedResponse,
  type NormalizedReadingInput 
} from "../_shared/validation.ts";
import { normalizeDoorData, getDoorFieldSource } from "../_shared/payloadNormalization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-api-key",
};

/**
 * Ingest Abstraction Layer - Vendor-Agnostic Sensor Data Ingestion
 * 
 * This edge function provides a unified API for ingesting sensor readings
 * from multiple sources (TTN, BLE hubs, simulators, future vendors).
 * 
 * Security: Requires X-Device-API-Key header when DEVICE_INGEST_API_KEY is configured
 * 
 * Features:
 * - Input validation using Zod schemas
 * - Tags readings with source for traceability
 * - Updates unit's last_temp_reading and last_reading_at
 * - Updates unit's door_state and door_last_changed_at for door events
 * - Updates device's battery_last_reported_at
 * - Stores source_metadata for vendor-specific debugging
 * - NO compliance/alert logic - that stays in process-unit-states
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate device API key
    const apiKeyResult = validateDeviceApiKey(req);
    if (!apiKeyResult.valid) {
      console.warn("[ingest-readings] API key validation failed:", apiKeyResult.error);
      return unauthorizedResponse(apiKeyResult.error || "Unauthorized", corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse and validate request body
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parseResult = ingestRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.warn("[ingest-readings] Validation failed:", parseResult.error.issues);
      return validationErrorResponse(parseResult.error, corsHeaders);
    }

    const { readings } = parseResult.data;

    console.log(`[ingest-readings] Received ${readings.length} validated readings`);

    const results: { unit_id: string; success: boolean; error?: string }[] = [];
    const unitUpdates: Map<string, { temp: number; time: string; doorOpen?: boolean; sensorType?: string }> = new Map();
    const deviceBatteryUpdates: Map<string, { level: number | null; voltage: number | null; signalStrength: number | null; time: string }> = new Map();

    for (const reading of readings) {
      try {
        // Validate unit exists and get reliability data
        const { data: unit, error: unitError } = await supabase
          .from("units")
          .select("id, door_state, last_checkin_at, consecutive_checkins, sensor_reliable")
          .eq("id", reading.unit_id)
          .maybeSingle();

        if (unitError || !unit) {
          results.push({
            unit_id: reading.unit_id,
            success: false,
            error: "Unit not found",
          });
          continue;
        }

        // Look up device_id if device_serial provided
        let deviceId: string | null = null;
        if (reading.device_serial) {
          const { data: device } = await supabase
            .from("devices")
            .select("id")
            .eq("serial_number", reading.device_serial)
            .maybeSingle();
          deviceId = device?.id || null;
        }

        const recordedAt = reading.recorded_at || new Date().toISOString();

        // Normalize door data - check explicit door_open field first, then try normalization
        // This handles various payload formats (door_status, door, open_close, etc.)
        const normalizedDoorOpen = reading.door_open !== undefined 
          ? reading.door_open 
          : normalizeDoorData(reading as unknown as Record<string, unknown>);
        const hasDoorData = normalizedDoorOpen !== undefined;

        if (hasDoorData) {
          const doorSource = getDoorFieldSource(reading as unknown as Record<string, unknown>);
          console.log(`[ingest-readings] Door data for unit ${reading.unit_id}: ${normalizedDoorOpen} from ${doorSource || 'door_open field'}`);
        }

        // Insert sensor reading with source tag
        const readingData: Record<string, unknown> = {
          unit_id: reading.unit_id,
          device_id: deviceId,
          temperature: reading.temperature,
          humidity: reading.humidity ?? null,
          battery_level: reading.battery_level ?? null,
          signal_strength: reading.signal_strength ?? null,
          source: reading.source,
          recorded_at: recordedAt,
          received_at: new Date().toISOString(),
        };

        // Only set door_open if door data is present (after normalization)
        if (hasDoorData) {
          readingData.door_open = normalizedDoorOpen;
        }

        const { error: insertError } = await supabase.from("sensor_readings").insert(readingData);

        if (insertError) {
          console.error(`[ingest-readings] Insert error for unit ${reading.unit_id}:`, insertError);
          results.push({
            unit_id: reading.unit_id,
            success: false,
            error: insertError.message,
          });
          continue;
        }

        // Track door state changes - insert into door_events if changed OR if initial state
        if (normalizedDoorOpen !== undefined) {
          const newDoorState = normalizedDoorOpen ? "open" : "closed";
          const currentDoorState = unit.door_state || "unknown";
          const isInitialReading = currentDoorState === "unknown" || currentDoorState === null;
          const stateChanged = newDoorState !== currentDoorState;
          
          if (isInitialReading || stateChanged) {
            // Insert door event - including initial reading to establish baseline
            await supabase.from("door_events").insert({
              unit_id: reading.unit_id,
              state: newDoorState,
              occurred_at: recordedAt,
              source: reading.source,
              metadata: { 
                temperature: reading.temperature,
                is_initial: isInitialReading,
              },
            });
            console.log(`[ingest-readings] Door event: ${currentDoorState} -> ${newDoorState} (initial: ${isInitialReading}) for unit ${reading.unit_id}`);
          }
        }

        // Track latest reading per unit for batch update
        // Include sensorType so we can gate door_state updates
        const existing = unitUpdates.get(reading.unit_id);
        if (!existing || new Date(recordedAt) > new Date(existing.time)) {
          unitUpdates.set(reading.unit_id, {
            temp: reading.temperature,
            time: recordedAt,
            doorOpen: normalizedDoorOpen,
            sensorType: reading.source === 'simulator' ? 'door' : undefined, // Simulator always counts as door
          });
        }

        // Track battery and signal updates for devices
        if (deviceId && (reading.battery_level !== undefined || reading.battery_voltage !== undefined || reading.signal_strength !== undefined)) {
          const existingBattery = deviceBatteryUpdates.get(deviceId);
          if (!existingBattery || new Date(recordedAt) > new Date(existingBattery.time)) {
            deviceBatteryUpdates.set(deviceId, {
              level: reading.battery_level ?? null,
              voltage: reading.battery_voltage ?? null,
              signalStrength: reading.signal_strength ?? null,
              time: recordedAt,
            });
          }
        }

        results.push({
          unit_id: reading.unit_id,
          success: true,
        });

        console.log(
          `[ingest-readings] Ingested reading: unit=${reading.unit_id}, temp=${reading.temperature}, door=${reading.door_open}, source=${reading.source}`
        );
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`[ingest-readings] Error processing reading:`, err);
        results.push({
          unit_id: reading.unit_id || "unknown",
          success: false,
          error: errorMessage,
        });
      }
    }

    // Batch update units with latest readings, door state, and sensor reliability
    for (const [unitId, update] of unitUpdates) {
      // Fetch current unit state for reliability calculation
      const { data: currentUnit } = await supabase
        .from("units")
        .select("last_checkin_at, consecutive_checkins, sensor_reliable")
        .eq("id", unitId)
        .maybeSingle();

      const now = new Date(update.time);
      const lastCheckin = currentUnit?.last_checkin_at ? new Date(currentUnit.last_checkin_at) : null;
      
      // Calculate consecutive check-ins (5-minute expected interval with 2.5x buffer)
      const expectedIntervalMs = 300 * 1000; // 5 minutes
      const threshold = expectedIntervalMs * 2.5; // Allow some buffer
      
      let newConsecutive = 1;
      if (lastCheckin) {
        const gap = now.getTime() - lastCheckin.getTime();
        if (gap <= threshold && gap > 0) {
          newConsecutive = (currentUnit?.consecutive_checkins || 0) + 1;
        }
      }
      
      // Sensor becomes reliable after 2 consecutive check-ins
      const sensorReliable = newConsecutive >= 2;

      const updateData: Record<string, unknown> = {
        last_temp_reading: update.temp,
        last_reading_at: update.time,
        last_checkin_at: update.time,
        consecutive_checkins: newConsecutive,
        sensor_reliable: sensorReliable,
        status: "ok", // Mark unit as OK when receiving valid readings
      };
      
      // STEP D: Only update door_state if this reading came from a door sensor
      // Prevent temp sensors from overwriting door state
      const isDoorSensor = update.sensorType === 'door' || update.sensorType === 'contact';
      if (update.doorOpen !== undefined && isDoorSensor) {
        updateData.door_state = update.doorOpen ? "open" : "closed";
        updateData.door_last_changed_at = update.time;
        // Door events also count as activity, reset consecutive counter if needed
        if (newConsecutive === 0) {
          updateData.consecutive_checkins = 1;
        }
      } else if (update.doorOpen !== undefined && !isDoorSensor) {
        console.log(`[ingest-readings] BLOCKED door_state update from non-door sensor: sensorType=${update.sensorType} unitId=${unitId}`);
      }
      
      await supabase
        .from("units")
        .update(updateData)
        .eq("id", unitId);

      console.log(`[ingest-readings] Unit ${unitId} reliability: consecutive=${newConsecutive}, reliable=${sensorReliable}`);
    }

    // Batch update devices with battery and signal info
    for (const [deviceId, batteryUpdate] of deviceBatteryUpdates) {
      const updateData: Record<string, unknown> = {
        battery_last_reported_at: batteryUpdate.time,
        last_seen_at: batteryUpdate.time,
      };
      if (batteryUpdate.level !== null) {
        updateData.battery_level = batteryUpdate.level;
      }
      if (batteryUpdate.voltage !== null) {
        updateData.battery_voltage = batteryUpdate.voltage;
      }
      if (batteryUpdate.signalStrength !== null) {
        updateData.signal_strength = batteryUpdate.signalStrength;
      }
      
      await supabase
        .from("devices")
        .update(updateData)
        .eq("id", deviceId);
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(
      `[ingest-readings] Complete: ${successCount} success, ${failureCount} failures`
    );

    return new Response(
      JSON.stringify({
        success: true,
        ingested: successCount,
        failed: failureCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[ingest-readings] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
