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
  confirm_time_door_closed: number;
  confirm_time_door_open: number;
  last_status_change: string | null;
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

function getSiteId(unit: any): string {
  const area = unit.area;
  if (Array.isArray(area)) return area[0]?.site_id || "";
  return area?.site_id || "";
}

function getAreaId(unit: any): string {
  return unit.area_id || "";
}

type UnitStatus = "ok" | "excursion" | "alarm_active" | "monitoring_interrupted" | "manual_required" | "restoring" | "offline";

// Data gap threshold: 2x expected interval (60s) + 2 minutes = 4 minutes
const DATA_GAP_THRESHOLD_MS = 4 * 60 * 1000;
// Readings needed to restore
const READINGS_TO_RESTORE = 2;
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

    // Get all active units with door state and confirm times
    const { data: units, error: unitsError } = await supabase
      .from("units")
      .select(`
        id, name, status, last_reading_at, last_temp_reading, area_id,
        temp_limit_high, temp_limit_low, temp_hysteresis, manual_log_cadence,
        door_state, door_last_changed_at, door_open_grace_minutes,
        confirm_time_door_closed, confirm_time_door_open, last_status_change,
        area:areas!inner(site_id, site:sites!inner(organization_id))
      `)
      .eq("is_active", true);

    if (unitsError) {
      console.error("Error fetching units:", unitsError);
      throw unitsError;
    }

    const now = Date.now();
    const stateChanges: { unitId: string; from: string; to: string; reason: string }[] = [];
    const newAlertIds: string[] = [];

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

      // Confirm times (in seconds, convert to ms)
      const confirmTimeDoorClosed = (unit.confirm_time_door_closed || 600) * 1000; // default 10 min
      const confirmTimeDoorOpen = (unit.confirm_time_door_open || 1200) * 1000; // default 20 min
      const confirmTime = doorState === "open" ? confirmTimeDoorOpen : confirmTimeDoorClosed;

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
            // Check if we should escalate to alarm based on confirm window
            const statusChangeTime = unit.last_status_change ? new Date(unit.last_status_change).getTime() : now;
            const timeInExcursion = now - statusChangeTime;

            if (timeInExcursion >= confirmTime) {
              newStatus = "alarm_active";
              reason = `Temperature excursion confirmed after ${Math.floor(timeInExcursion / 60000)}m: ${temp}°F (door ${doorState})`;
            } else {
              console.log(`Unit ${unit.name}: Excursion pending confirmation (${Math.floor(timeInExcursion / 60000)}/${Math.floor(confirmTime / 60000)}m)`);
            }
          }

          // Create or update temp_excursion alert when entering excursion state
          if (newStatus === "excursion" && currentStatus !== "excursion") {
            // Check if alert already exists
            const { data: existingAlert } = await supabase
              .from("alerts")
              .select("id")
              .eq("unit_id", unit.id)
              .eq("alert_type", "temp_excursion")
              .in("status", ["active", "acknowledged"])
              .maybeSingle();

            if (!existingAlert) {
              const doorContext = doorState !== "unknown" ? ` (door ${doorState})` : "";
              const nowIso = new Date().toISOString();
              const { data: alertData, error: alertError } = await supabase.from("alerts").insert({
                unit_id: unit.id,
                organization_id: getOrgId(unit),
                site_id: getSiteId(unit),
                area_id: getAreaId(unit),
                source: "sensor",
                title: `${unit.name}: Temperature Excursion${doorContext}`,
                message: reason,
                alert_type: "temp_excursion",
                severity: "critical",
                temp_reading: temp,
                temp_limit: isAboveLimit ? highLimit : lowLimit,
                first_active_at: nowIso,
                metadata: {
                  current_temp: temp,
                  low_limit: lowLimit,
                  high_limit: highLimit,
                  reading_source: "sensor",
                  reading_at: unit.last_reading_at,
                  door_state: doorState,
                },
              }).select("id").single();
              
              if (!alertError && alertData) {
                newAlertIds.push(alertData.id);
                console.log(`Created temp_excursion alert (CRITICAL) for unit ${unit.name}`);
              }
            }
          }

          // Escalate temp_excursion to critical when alarm_active
          if (newStatus === "alarm_active" && currentStatus === "excursion") {
            const statusChangeTime = unit.last_status_change ? new Date(unit.last_status_change).getTime() : now;
            const durationMinutes = Math.floor((now - statusChangeTime) / 60000);

            // Update existing temp_excursion alert to critical
            const { error: updateError } = await supabase
              .from("alerts")
              .update({
                severity: "critical",
                title: `${unit.name}: Temperature Alarm (${doorState !== "unknown" ? `door ${doorState}` : "confirmed"})`,
                message: `Temperature excursion confirmed: ${temp}°F after ${durationMinutes}m`,
                metadata: {
                  current_temp: temp,
                  low_limit: lowLimit,
                  high_limit: highLimit,
                  reading_source: "sensor",
                  reading_at: unit.last_reading_at,
                  door_state: doorState,
                  duration_minutes: durationMinutes,
                },
              })
              .eq("unit_id", unit.id)
              .eq("alert_type", "temp_excursion")
              .in("status", ["active", "acknowledged"]);

            if (!updateError) {
              console.log(`Escalated temp_excursion alert to critical for unit ${unit.name}`);
            }
          }

          // Check for suspected cooling failure
          if ((doorState === "closed" || doorState === "unknown") && 
              (currentStatus === "excursion" || currentStatus === "alarm_active" || newStatus === "excursion" || newStatus === "alarm_active")) {
            const coolingCheckTime = new Date(now - COOLING_FAILURE_THRESHOLD_MINUTES * 60 * 1000).toISOString();
            const { data: recentReadings } = await supabase
              .from("sensor_readings")
              .select("temperature, recorded_at")
              .eq("unit_id", unit.id)
              .gte("recorded_at", coolingCheckTime)
              .order("recorded_at", { ascending: false });

            if (recentReadings && recentReadings.length >= 5) {
              const allOutOfRange = recentReadings.every((r: { temperature: number }) => {
                const above = r.temperature > highLimit;
                const below = lowLimit !== null && r.temperature < lowLimit;
                return above || below;
              });

              if (allOutOfRange && recentReadings.length >= 3) {
                const newest = recentReadings[0].temperature;
                const oldest = recentReadings[recentReadings.length - 1].temperature;
                const isNotRecovering = isAboveLimit 
                  ? (newest >= oldest - 0.5)
                  : (newest <= oldest + 0.5);

                if (isNotRecovering) {
                  const { data: existingAlert } = await supabase
                    .from("alerts")
                    .select("id")
                    .eq("unit_id", unit.id)
                    .eq("alert_type", "suspected_cooling_failure")
                    .in("status", ["active", "acknowledged"])
                    .maybeSingle();

                  if (!existingAlert) {
                    const { data: alertData } = await supabase.from("alerts").insert({
                      unit_id: unit.id,
                      organization_id: getOrgId(unit),
                      site_id: getSiteId(unit),
                      area_id: getAreaId(unit),
                      source: "sensor",
                      title: `${unit.name}: Suspected Cooling Failure`,
                      message: `Door closed; temp not recovering; possible cooling system issue. Current: ${temp}°F`,
                      alert_type: "suspected_cooling_failure",
                      severity: "warning",
                      temp_reading: temp,
                      temp_limit: highLimit,
                    }).select("id").single();
                    
                    if (alertData) {
                      newAlertIds.push(alertData.id);
                      console.log(`Created suspected_cooling_failure alert for unit ${unit.name}`);
                    }
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
              
              // Resolve temp_excursion alert
              await supabase
                .from("alerts")
                .update({
                  status: "resolved",
                  resolved_at: new Date().toISOString(),
                })
                .eq("unit_id", unit.id)
                .eq("alert_type", "temp_excursion")
                .in("status", ["active", "acknowledged"]);
              
              console.log(`Resolved temp_excursion alert for unit ${unit.name}`);
              
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
              // Check for consecutive good readings
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
              newStatus = "restoring";
              reason = "Monitoring resumed";
              
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

        // Create alert for monitoring_interrupted/manual_required
        if (["monitoring_interrupted", "manual_required", "offline"].includes(newStatus)) {
          const { data: existingAlert } = await supabase
            .from("alerts")
            .select("id")
            .eq("unit_id", unit.id)
            .eq("alert_type", "monitoring_interrupted")
            .in("status", ["active", "acknowledged"])
            .maybeSingle();

          if (!existingAlert) {
            const { data: alertData } = await supabase.from("alerts").insert({
              unit_id: unit.id,
              organization_id: getOrgId(unit),
              site_id: getSiteId(unit),
              area_id: getAreaId(unit),
              source: "sensor",
              title: `${unit.name}: ${newStatus.replace(/_/g, " ").toUpperCase()}`,
              message: reason,
              alert_type: "monitoring_interrupted",
              severity: "warning",
            }).select("id").single();
            
            if (alertData) {
              newAlertIds.push(alertData.id);
              console.log(`Created monitoring_interrupted alert for unit ${unit.name}`);
            }
          }
        }

        // Resolve alerts when status improves to ok
        if (newStatus === "ok") {
          await supabase
            .from("alerts")
            .update({
              status: "resolved",
              resolved_at: new Date().toISOString(),
            })
            .eq("unit_id", unit.id)
            .in("alert_type", ["monitoring_interrupted", "temp_excursion", "alarm_active", "suspected_cooling_failure"])
            .in("status", ["active", "acknowledged"]);
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

    // Trigger escalations if there are new alerts
    if (newAlertIds.length > 0) {
      console.log(`Triggering escalations for ${newAlertIds.length} new alerts`);
      try {
        await supabase.functions.invoke("process-escalations");
      } catch (escError) {
        console.error("Error triggering escalations:", escError);
      }
    }

    console.log(`Processed ${(units || []).length} units, ${stateChanges.length} state changes, ${newAlertIds.length} new alerts`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: (units || []).length,
        changes: stateChanges,
        newAlerts: newAlertIds.length,
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