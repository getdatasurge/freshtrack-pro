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
  door_state: string | null;
  door_last_changed_at: string | null;
  door_open_grace_minutes: number;
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
// Suspected cooling failure threshold (minutes)
const COOLING_FAILURE_THRESHOLD_MINUTES = 45;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("Processing unit states...");

    // Get all active units with door state
    const { data: units, error: unitsError } = await supabase
      .from("units")
      .select(`
        id, name, status, last_reading_at, last_temp_reading,
        temp_limit_high, temp_limit_low, temp_hysteresis, manual_log_cadence,
        door_state, door_last_changed_at, door_open_grace_minutes,
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

      // Door state context
      const doorState = unit.door_state || "unknown";
      const doorGraceMinutes = unit.door_open_grace_minutes || 20;
      const doorLastChanged = unit.door_last_changed_at ? new Date(unit.door_last_changed_at).getTime() : null;
      const doorOpenDuration = doorState === "open" && doorLastChanged 
        ? Math.floor((now - doorLastChanged) / 60000) 
        : 0;
      const isDoorOpenWithinGrace = doorState === "open" && doorOpenDuration < doorGraceMinutes;

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
          // If door is open and within grace period, delay escalation
          if (isDoorOpenWithinGrace && currentStatus === "ok") {
            // Don't transition yet - door open grace
            console.log(`Unit ${unit.name}: Temp out of range but door open (${doorOpenDuration}/${doorGraceMinutes}m grace)`);
          } else if (currentStatus === "ok" || currentStatus === "restoring") {
            newStatus = "excursion";
            reason = `Temperature ${temp}°F ${isAboveLimit ? "above" : "below"} limit${doorState === "open" ? " (door open)" : ""}`;
          } else if (currentStatus === "excursion") {
            // Check if we should escalate to alarm
            // If door is open and grace just expired, now transition
            if (doorState === "open" && doorOpenDuration >= doorGraceMinutes) {
              newStatus = "alarm_active";
              reason = `Sustained temperature excursion: ${temp}°F (door open ${doorOpenDuration}m, grace expired)`;
            } else if (doorState !== "open") {
              // Door closed - normal escalation
              newStatus = "alarm_active";
              reason = `Sustained temperature excursion: ${temp}°F (door closed)`;
            }
          }

          // Check for suspected cooling failure
          // Conditions: door closed/unknown, temp out of range for 45+ minutes
          if ((doorState === "closed" || doorState === "unknown") && 
              (currentStatus === "excursion" || currentStatus === "alarm_active")) {
            // Get readings from last 45 minutes
            const coolingCheckTime = new Date(now - COOLING_FAILURE_THRESHOLD_MINUTES * 60 * 1000).toISOString();
            const { data: recentReadings } = await supabase
              .from("sensor_readings")
              .select("temperature, recorded_at")
              .eq("unit_id", unit.id)
              .gte("recorded_at", coolingCheckTime)
              .order("recorded_at", { ascending: false });

            if (recentReadings && recentReadings.length >= 5) {
              // Check if all readings are out of range
              const allOutOfRange = recentReadings.every((r: { temperature: number }) => {
                const above = r.temperature > highLimit;
                const below = lowLimit !== null && r.temperature < lowLimit;
                return above || below;
              });

              // Check trend - is temp flat or rising?
              if (allOutOfRange && recentReadings.length >= 3) {
                const newest = recentReadings[0].temperature;
                const oldest = recentReadings[recentReadings.length - 1].temperature;
                const isNotRecovering = isAboveLimit 
                  ? (newest >= oldest - 0.5) // Not cooling down
                  : (newest <= oldest + 0.5); // Not warming up

                if (isNotRecovering) {
                  // Create suspected cooling failure alert if not exists
                  const { data: existingAlert } = await supabase
                    .from("alerts")
                    .select("id")
                    .eq("unit_id", unit.id)
                    .eq("alert_type", "suspected_cooling_failure")
                    .in("status", ["active", "acknowledged"])
                    .maybeSingle();

                  if (!existingAlert) {
                    await supabase.from("alerts").insert({
                      unit_id: unit.id,
                      title: `${unit.name}: Suspected Cooling Failure`,
                      message: `Door closed; temp not recovering; possible cooling system issue. Current: ${temp}°F`,
                      alert_type: "suspected_cooling_failure",
                      severity: "warning",
                      temp_reading: temp,
                      temp_limit: highLimit,
                    });
                    console.log(`Created suspected_cooling_failure alert for unit ${unit.name}`);
                  }
                }
              }
            }
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
              
              // Resolve suspected cooling failure alert if exists
              await supabase
                .from("alerts")
                .update({
                  status: "resolved",
                  resolved_at: new Date().toISOString(),
                })
                .eq("unit_id", unit.id)
                .eq("alert_type", "suspected_cooling_failure")
                .in("status", ["active", "acknowledged"]);
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
              
              // Resolve monitoring_interrupted alerts when sensor comes back
              await supabase
                .from("alerts")
                .update({
                  status: "resolved",
                  resolved_at: new Date().toISOString(),
                })
                .eq("unit_id", unit.id)
                .eq("alert_type", "monitoring_interrupted")
                .in("status", ["active", "acknowledged"]);
              
              console.log(`Resolved monitoring_interrupted alerts for unit ${unit.name}`);
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

        // Create alert for critical state changes (deduplicated)
        if (["alarm_active", "monitoring_interrupted", "manual_required", "offline"].includes(newStatus)) {
          const alertType = newStatus === "alarm_active" ? "alarm_active" : "monitoring_interrupted";
          const severity = newStatus === "alarm_active" ? "critical" : "warning";

          // Check if alert already exists
          const { data: existingAlert } = await supabase
            .from("alerts")
            .select("id")
            .eq("unit_id", unit.id)
            .eq("alert_type", alertType)
            .in("status", ["active", "acknowledged"])
            .maybeSingle();

          if (!existingAlert) {
            const doorContext = doorState !== "unknown" ? ` (door ${doorState})` : "";
            await supabase.from("alerts").insert({
              unit_id: unit.id,
              title: `${unit.name}: ${newStatus.replace(/_/g, " ").toUpperCase()}${doorContext}`,
              message: reason,
              alert_type: alertType,
              severity: severity,
              temp_reading: unit.last_temp_reading,
              temp_limit: unit.temp_limit_high,
            });
            console.log(`Created ${alertType} alert for unit ${unit.name}`);
          }
        }

        // Resolve alerts when status improves
        if (newStatus === "ok" || newStatus === "restoring") {
          // Resolve monitoring alerts
          await supabase
            .from("alerts")
            .update({
              status: "resolved",
              resolved_at: new Date().toISOString(),
            })
            .eq("unit_id", unit.id)
            .eq("alert_type", "monitoring_interrupted")
            .in("status", ["active", "acknowledged"]);
          
          // Resolve temperature alarms if ok
          if (newStatus === "ok") {
            await supabase
              .from("alerts")
              .update({
                status: "resolved",
                resolved_at: new Date().toISOString(),
              })
              .eq("unit_id", unit.id)
              .eq("alert_type", "alarm_active")
              .in("status", ["active", "acknowledged"]);
            
            // Also resolve suspected cooling failure
            await supabase
              .from("alerts")
              .update({
                status: "resolved",
                resolved_at: new Date().toISOString(),
              })
              .eq("unit_id", unit.id)
              .eq("alert_type", "suspected_cooling_failure")
              .in("status", ["active", "acknowledged"]);
          }
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
            door_state: doorState,
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
