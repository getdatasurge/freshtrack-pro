import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Normalized Reading Interface - vendor-agnostic sensor data
 */
interface NormalizedReading {
  unit_id: string;
  device_serial?: string;
  temperature: number;
  humidity?: number;
  battery_level?: number;
  signal_strength?: number;
  door_open?: boolean;
  source: "ttn" | "ble" | "simulator" | "manual_sensor" | "api";
  source_metadata?: Record<string, unknown>;
  recorded_at?: string;
}

interface IngestRequest {
  readings: NormalizedReading[];
}

/**
 * Ingest Abstraction Layer - Vendor-Agnostic Sensor Data Ingestion
 * 
 * This edge function provides a unified API for ingesting sensor readings
 * from multiple sources (TTN, BLE hubs, simulators, future vendors).
 * 
 * Features:
 * - Tags readings with source for traceability
 * - Updates unit's last_temp_reading and last_reading_at
 * - Stores source_metadata for vendor-specific debugging
 * - NO compliance/alert logic - that stays in process-unit-states
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: IngestRequest = await req.json();
    const { readings } = body;

    if (!readings || !Array.isArray(readings) || readings.length === 0) {
      return new Response(
        JSON.stringify({ error: "No readings provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ingest-readings] Received ${readings.length} readings`);

    const results: { unit_id: string; success: boolean; error?: string }[] = [];
    const unitUpdates: Map<string, { temp: number; time: string }> = new Map();

    for (const reading of readings) {
      try {
        // Validate required fields
        if (!reading.unit_id || reading.temperature === undefined) {
          results.push({
            unit_id: reading.unit_id || "unknown",
            success: false,
            error: "Missing unit_id or temperature",
          });
          continue;
        }

        // Validate unit exists
        const { data: unit, error: unitError } = await supabase
          .from("units")
          .select("id")
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

        // Insert sensor reading with source tag
        const { error: insertError } = await supabase.from("sensor_readings").insert({
          unit_id: reading.unit_id,
          device_id: deviceId,
          temperature: reading.temperature,
          humidity: reading.humidity ?? null,
          battery_level: reading.battery_level ?? null,
          signal_strength: reading.signal_strength ?? null,
          door_open: reading.door_open ?? false,
          source: reading.source,
          recorded_at: recordedAt,
          received_at: new Date().toISOString(),
        });

        if (insertError) {
          console.error(`[ingest-readings] Insert error for unit ${reading.unit_id}:`, insertError);
          results.push({
            unit_id: reading.unit_id,
            success: false,
            error: insertError.message,
          });
          continue;
        }

        // Track latest reading per unit for batch update
        const existing = unitUpdates.get(reading.unit_id);
        if (!existing || new Date(recordedAt) > new Date(existing.time)) {
          unitUpdates.set(reading.unit_id, {
            temp: reading.temperature,
            time: recordedAt,
          });
        }

        results.push({
          unit_id: reading.unit_id,
          success: true,
        });

        console.log(
          `[ingest-readings] Ingested reading: unit=${reading.unit_id}, temp=${reading.temperature}, source=${reading.source}`
        );
      } catch (err: any) {
        console.error(`[ingest-readings] Error processing reading:`, err);
        results.push({
          unit_id: reading.unit_id || "unknown",
          success: false,
          error: err.message,
        });
      }
    }

    // Batch update units with latest readings
    for (const [unitId, update] of unitUpdates) {
      await supabase
        .from("units")
        .update({
          last_temp_reading: update.temp,
          last_reading_at: update.time,
        })
        .eq("id", unitId);
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
  } catch (error: any) {
    console.error("[ingest-readings] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
