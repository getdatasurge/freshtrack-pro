import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UnitRow {
  id: string;
  name: string;
  status: string;
  last_reading_at: string | null;
  last_temp_reading: number | null;
  temp_limit_high: number;
  temp_limit_low: number | null;
  temp_hysteresis: number;
  manual_log_cadence: number;
  area: {
    site: {
      organization_id: string;
    };
  };
}

function getOrgId(unit: any): string {
  const area = unit.area;
  if (Array.isArray(area)) {
    const site = area[0]?.site;
    if (Array.isArray(site)) return site[0]?.organization_id || "";
    return site?.organization_id || "";
  }
  const site = area?.site;
  if (Array.isArray(site)) return site[0]?.organization_id || "";
  return site?.organization_id || "";
}

type UnitStatus = "ok" | "excursion" | "alarm_active" | "monitoring_interrupted" | "manual_required" | "restoring" | "offline";

// Data gap threshold: 2x expected interval (60s) + 2 minutes = 4 minutes
const DATA_GAP_THRESHOLD_MS = 4 * 60 * 1000;
// Excursion confirmation time (seconds)
const EXCURSION_CONFIRM_TIME = 600; // 10 minutes
// Readings needed to restore
const READINGS_TO_RESTORE = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("Processing unit states...");

    // Get all active units
    const { data: units, error: unitsError } = await supabase
      .from("units")
      .select(`
        id, name, status, last_reading_at, last_temp_reading,
        temp_limit_high, temp_limit_low, temp_hysteresis, manual_log_cadence,
        area:areas!inner(site:sites!inner(organization_id))
      `)
      .eq("is_active", true);

    if (unitsError) {
      console.error("Error fetching units:", unitsError);
      throw unitsError;
    }

    const now = Date.now();
    const stateChanges: { unitId: string; from: string; to: string; reason: string }[] = [];

    for (const unit of (units || []) as any[]) {
      const currentStatus = unit.status as UnitStatus;
      let newStatus: UnitStatus = currentStatus;
      let reason = "";

      const lastReadingTime = unit.last_reading_at ? new Date(unit.last_reading_at).getTime() : null;
      const timeSinceReading = lastReadingTime ? now - lastReadingTime : Infinity;

      // Check for data gap - transition to MONITORING_INTERRUPTED
      if (timeSinceReading > DATA_GAP_THRESHOLD_MS) {
        if (currentStatus !== "monitoring_interrupted" && currentStatus !== "manual_required" && currentStatus !== "offline") {
          newStatus = "monitoring_interrupted";
          reason = `No sensor data for ${Math.floor(timeSinceReading / 60000)} minutes`;
        }
        
        // MONITORING_INTERRUPTED immediately becomes MANUAL_REQUIRED
        if (currentStatus === "monitoring_interrupted" || newStatus === "monitoring_interrupted") {
          newStatus = "manual_required";
          reason = "Monitoring interrupted - manual logging required";
        }
      }

      // Check temperature excursion (only if we have recent data)
      if (timeSinceReading <= DATA_GAP_THRESHOLD_MS && unit.last_temp_reading !== null) {
        const temp = unit.last_temp_reading;
        const highLimit = unit.temp_limit_high;
        const lowLimit = unit.temp_limit_low;
        const hysteresis = unit.temp_hysteresis;

        const isAboveLimit = temp > highLimit;
        const isBelowLimit = lowLimit !== null && temp < lowLimit;

        if (isAboveLimit || isBelowLimit) {
          // Temperature out of range
          if (currentStatus === "ok" || currentStatus === "restoring") {
            newStatus = "excursion";
            reason = `Temperature ${temp}°F ${isAboveLimit ? "above" : "below"} limit`;
          } else if (currentStatus === "excursion") {
            // Check if we should escalate to alarm
            // For now, transition immediately for demo purposes
            newStatus = "alarm_active";
            reason = `Sustained temperature excursion: ${temp}°F`;
          }
        } else {
          // Temperature in range
          const inRangeWithHysteresis = 
            temp <= (highLimit - hysteresis) && 
            (lowLimit === null || temp >= (lowLimit + hysteresis));

          if (inRangeWithHysteresis) {
            if (currentStatus === "excursion" || currentStatus === "alarm_active") {
              newStatus = "restoring";
              reason = "Temperature returning to range";
            } else if (currentStatus === "restoring") {
              // Check for 3 consecutive good readings
              const { data: recentReadings } = await supabase
                .from("sensor_readings")
                .select("temperature")
                .eq("unit_id", unit.id)
                .order("recorded_at", { ascending: false })
                .limit(READINGS_TO_RESTORE);

              const allInRange = (recentReadings || []).length >= READINGS_TO_RESTORE &&
                (recentReadings || []).every((r: { temperature: number }) => {
                  const t = r.temperature;
                  return t <= (highLimit - hysteresis) && 
                    (lowLimit === null || t >= (lowLimit + hysteresis));
                });

              if (allInRange) {
                newStatus = "ok";
                reason = "Temperature stable in range";
              }
            } else if (currentStatus === "manual_required" || currentStatus === "monitoring_interrupted") {
              // Sensor resumed with good readings
              newStatus = "restoring";
              reason = "Monitoring resumed";
            }
          }
        }
      }

      // Update status if changed
      if (newStatus !== currentStatus) {
        console.log(`Unit ${unit.name}: ${currentStatus} -> ${newStatus} (${reason})`);
        
        const { error: updateError } = await supabase
          .from("units")
          .update({
            status: newStatus,
            last_status_change: new Date().toISOString(),
          })
          .eq("id", unit.id);

        if (updateError) {
          console.error(`Error updating unit ${unit.id}:`, updateError);
          continue;
        }

        stateChanges.push({
          unitId: unit.id,
          from: currentStatus,
          to: newStatus,
          reason,
        });

        // Create alert for critical state changes
        if (["alarm_active", "monitoring_interrupted", "manual_required"].includes(newStatus)) {
          const alertType = newStatus === "alarm_active" ? "alarm_active" : "monitoring_interrupted";
          const severity = newStatus === "alarm_active" ? "critical" : "warning";

          await supabase.from("alerts").insert({
            unit_id: unit.id,
            title: `${unit.name}: ${newStatus.replace(/_/g, " ").toUpperCase()}`,
            message: reason,
            alert_type: alertType,
            severity: severity,
            temp_reading: unit.last_temp_reading,
            temp_limit: unit.temp_limit_high,
          });
        }

        // Log state change to event_logs
        await supabase.from("event_logs").insert({
          organization_id: getOrgId(unit),
          unit_id: unit.id,
          event_type: "unit_state_change",
          actor_type: "system",
          event_data: {
            from_status: currentStatus,
            to_status: newStatus,
            reason,
            temp_reading: unit.last_temp_reading,
          },
        });
      }
    }

    console.log(`Processed ${(units || []).length} units, ${stateChanges.length} state changes`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: (units || []).length,
        changes: stateChanges,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in process-unit-states:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
