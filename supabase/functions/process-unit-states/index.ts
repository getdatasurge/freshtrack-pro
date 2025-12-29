import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateInternalApiKey, unauthorizedResponse } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-api-key",
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

function getOrgId(unit: unknown): string {
  const u = unit as Record<string, unknown>;
  const area = u.area as Record<string, unknown> | Array<Record<string, unknown>>;
  if (Array.isArray(area)) {
    const site = area[0]?.site as Record<string, unknown> | Array<Record<string, unknown>>;
    if (Array.isArray(site)) return (site[0]?.organization_id as string) || "";
    return (site?.organization_id as string) || "";
  }
  const site = area?.site as Record<string, unknown> | Array<Record<string, unknown>>;
  if (Array.isArray(site)) return (site[0]?.organization_id as string) || "";
  return (site?.organization_id as string) || "";
}

function getSiteId(unit: unknown): string {
  const u = unit as Record<string, unknown>;
  const area = u.area as Record<string, unknown> | Array<Record<string, unknown>>;
  if (Array.isArray(area)) return (area[0]?.site_id as string) || "";
  return (area?.site_id as string) || "";
}

function getAreaId(unit: unknown): string {
  const u = unit as Record<string, unknown>;
  return (u.area_id as string) || "";
}

type UnitStatus = "ok" | "excursion" | "alarm_active" | "monitoring_interrupted" | "manual_required" | "restoring" | "offline";

// Readings needed to restore
const READINGS_TO_RESTORE = 2;
// Suspected cooling failure threshold (minutes)
const COOLING_FAILURE_THRESHOLD_MINUTES = 45;

// Calculate dynamic data gap threshold from alert rules
function calculateDataGapThreshold(rules: Record<string, unknown> | null): number {
  const expectedIntervalSeconds = (rules?.expected_reading_interval_seconds as number) ?? 60;
  const multiplier = (rules?.offline_trigger_multiplier as number) ?? 2.0;
  const additionalMinutes = (rules?.offline_trigger_additional_minutes as number) ?? 2;
  
  // threshold = (expected_interval * multiplier) + additional_minutes
  return (expectedIntervalSeconds * multiplier * 1000) + (additionalMinutes * 60 * 1000);
}

/**
 * Process Unit States - Internal Scheduled Function
 * 
 * Security: Requires INTERNAL_API_KEY when configured
 * 
 * This function processes all active units to:
 * - Detect data gaps and trigger monitoring_interrupted alerts
 * - Detect temperature excursions and create alerts
 * - Track door states and grace periods
 * - Detect suspected cooling failures
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate internal API key
    const apiKeyResult = validateInternalApiKey(req);
    if (!apiKeyResult.valid) {
      console.warn("[process-unit-states] API key validation failed:", apiKeyResult.error);
      return unauthorizedResponse(apiKeyResult.error || "Unauthorized", corsHeaders);
    }

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

    for (const unit of (units || []) as unknown[]) {
      const u = unit as Record<string, unknown>;
      const currentStatus = u.status as UnitStatus;
      let newStatus: UnitStatus = currentStatus;
      let reason = "";

      const lastReadingTime = u.last_reading_at ? new Date(u.last_reading_at as string).getTime() : null;
      const timeSinceReading = lastReadingTime ? now - lastReadingTime : Infinity;

      // Door state context
      const doorState = (u.door_state as string) || "unknown";
      const doorGraceMinutes = (u.door_open_grace_minutes as number) || 20;
      const doorLastChanged = u.door_last_changed_at ? new Date(u.door_last_changed_at as string).getTime() : null;
      const doorOpenDuration = doorState === "open" && doorLastChanged 
        ? Math.floor((now - doorLastChanged) / 60000) 
        : 0;
      const isDoorOpenWithinGrace = doorState === "open" && doorOpenDuration < doorGraceMinutes;

      // Confirm times (in seconds, convert to ms)
      const confirmTimeDoorClosed = ((u.confirm_time_door_closed as number) || 600) * 1000; // default 10 min
      const confirmTimeDoorOpen = ((u.confirm_time_door_open as number) || 1200) * 1000; // default 20 min
      const confirmTime = doorState === "open" ? confirmTimeDoorOpen : confirmTimeDoorClosed;

      // Get per-unit alert rules for dynamic threshold
      const { data: effectiveRules } = await supabase.rpc("get_effective_alert_rules", { p_unit_id: u.id });
      const dataGapThresholdMs = calculateDataGapThreshold(effectiveRules as Record<string, unknown> | null);

      // Check for data gap - transition to MONITORING_INTERRUPTED
      if (timeSinceReading > dataGapThresholdMs) {
        if (currentStatus !== "monitoring_interrupted" && currentStatus !== "manual_required") {
          newStatus = "monitoring_interrupted";
          reason = `No sensor data for ${Math.floor(timeSinceReading / 60000)} minutes (threshold: ${Math.floor(dataGapThresholdMs / 60000)}m)`;
        }
        
        // MONITORING_INTERRUPTED immediately becomes MANUAL_REQUIRED
        if (currentStatus === "monitoring_interrupted" || newStatus === "monitoring_interrupted") {
          newStatus = "manual_required";
          reason = "Monitoring interrupted - manual logging required";
        }
      }

      // Check temperature excursion (only if we have recent data)
      if (timeSinceReading <= dataGapThresholdMs && u.last_temp_reading !== null) {
        const temp = u.last_temp_reading as number;
        const highLimit = u.temp_limit_high as number;
        const lowLimit = u.temp_limit_low as number | null;
        const hysteresis = u.temp_hysteresis as number;

        const isAboveLimit = temp > highLimit;
        const isBelowLimit = lowLimit !== null && temp < lowLimit;

        if (isAboveLimit || isBelowLimit) {
          // Temperature out of range
          if (isDoorOpenWithinGrace && currentStatus === "ok") {
            console.log(`Unit ${u.name}: Temp out of range but door open (${doorOpenDuration}/${doorGraceMinutes}m grace)`);
          } else if (currentStatus === "ok" || currentStatus === "restoring") {
            newStatus = "excursion";
            reason = `Temperature ${temp}°F ${isAboveLimit ? "above" : "below"} limit${doorState === "open" ? " (door open)" : ""}`;
          } else if (currentStatus === "excursion") {
            const statusChangeTime = u.last_status_change ? new Date(u.last_status_change as string).getTime() : now;
            const timeInExcursion = now - statusChangeTime;

            if (timeInExcursion >= confirmTime) {
              newStatus = "alarm_active";
              reason = `Temperature excursion confirmed after ${Math.floor(timeInExcursion / 60000)}m: ${temp}°F (door ${doorState})`;
            } else {
              console.log(`Unit ${u.name}: Excursion pending confirmation (${Math.floor(timeInExcursion / 60000)}/${Math.floor(confirmTime / 60000)}m)`);
            }
          }

          // Create or update temp_excursion alert when entering excursion state
          if (newStatus === "excursion" && currentStatus !== "excursion") {
            const { data: existingAlert } = await supabase
              .from("alerts")
              .select("id")
              .eq("unit_id", u.id)
              .eq("alert_type", "temp_excursion")
              .in("status", ["active", "acknowledged"])
              .maybeSingle();

            if (!existingAlert) {
              const doorContext = doorState !== "unknown" ? ` (door ${doorState})` : "";
              const nowIso = new Date().toISOString();
              const { data: alertData, error: alertError } = await supabase.from("alerts").insert({
                unit_id: u.id,
                organization_id: getOrgId(unit),
                site_id: getSiteId(unit),
                area_id: getAreaId(unit),
                source: "sensor",
                title: `${u.name}: Temperature Excursion${doorContext}`,
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
                  reading_at: u.last_reading_at,
                  door_state: doorState,
                },
              }).select("id").single();
              
              if (!alertError && alertData) {
                newAlertIds.push(alertData.id);
                console.log(`Created temp_excursion alert (CRITICAL) for unit ${u.name}`);
              }
            }
          }

          // Escalate temp_excursion to critical when alarm_active
          if (newStatus === "alarm_active" && currentStatus === "excursion") {
            const statusChangeTime = u.last_status_change ? new Date(u.last_status_change as string).getTime() : now;
            const durationMinutes = Math.floor((now - statusChangeTime) / 60000);

            await supabase
              .from("alerts")
              .update({
                severity: "critical",
                title: `${u.name}: Temperature Alarm (${doorState !== "unknown" ? `door ${doorState}` : "confirmed"})`,
                message: `Temperature excursion confirmed: ${temp}°F after ${durationMinutes}m`,
                metadata: {
                  current_temp: temp,
                  low_limit: lowLimit,
                  high_limit: highLimit,
                  reading_source: "sensor",
                  reading_at: u.last_reading_at,
                  door_state: doorState,
                  duration_minutes: durationMinutes,
                },
              })
              .eq("unit_id", u.id)
              .eq("alert_type", "temp_excursion")
              .in("status", ["active", "acknowledged"]);

            console.log(`Escalated temp_excursion alert to critical for unit ${u.name}`);
          }

          // Check for suspected cooling failure
          if ((doorState === "closed" || doorState === "unknown") && 
              (currentStatus === "excursion" || currentStatus === "alarm_active" || newStatus === "excursion" || newStatus === "alarm_active")) {
            const coolingCheckTime = new Date(now - COOLING_FAILURE_THRESHOLD_MINUTES * 60 * 1000).toISOString();
            const { data: recentReadings } = await supabase
              .from("sensor_readings")
              .select("temperature, recorded_at")
              .eq("unit_id", u.id)
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
                    .eq("unit_id", u.id)
                    .eq("alert_type", "suspected_cooling_failure")
                    .in("status", ["active", "acknowledged"])
                    .maybeSingle();

                  if (!existingAlert) {
                    const { data: alertData } = await supabase.from("alerts").insert({
                      unit_id: u.id,
                      organization_id: getOrgId(unit),
                      site_id: getSiteId(unit),
                      area_id: getAreaId(unit),
                      source: "sensor",
                      title: `${u.name}: Suspected Cooling Failure`,
                      message: `Door closed; temp not recovering; possible cooling system issue. Current: ${temp}°F`,
                      alert_type: "suspected_cooling_failure",
                      severity: "warning",
                      temp_reading: temp,
                      temp_limit: highLimit,
                    }).select("id").single();
                    
                    if (alertData) {
                      newAlertIds.push(alertData.id);
                      console.log(`Created suspected_cooling_failure alert for unit ${u.name}`);
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
                .eq("unit_id", u.id)
                .eq("alert_type", "temp_excursion")
                .in("status", ["active", "acknowledged"]);
              
              console.log(`Resolved temp_excursion alert for unit ${u.name}`);
              
              // Resolve suspected cooling failure alert if exists
              await supabase
                .from("alerts")
                .update({
                  status: "resolved",
                  resolved_at: new Date().toISOString(),
                })
                .eq("unit_id", u.id)
                .eq("alert_type", "suspected_cooling_failure")
                .in("status", ["active", "acknowledged"]);
            } else if (currentStatus === "restoring") {
              // Check for consecutive good readings
              const { data: recentReadings } = await supabase
                .from("sensor_readings")
                .select("temperature")
                .eq("unit_id", u.id)
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
            } else if (currentStatus === "manual_required" || currentStatus === "monitoring_interrupted" || currentStatus === "offline") {
              // Allow recovery from offline/manual_required states when readings arrive
              newStatus = "restoring";
              reason = `Monitoring resumed from ${currentStatus}`;
              
              await supabase
                .from("alerts")
                .update({
                  status: "resolved",
                  resolved_at: new Date().toISOString(),
                })
                .eq("unit_id", u.id)
                .eq("alert_type", "monitoring_interrupted")
                .in("status", ["active", "acknowledged"]);
              
              console.log(`Resolved monitoring_interrupted alerts for unit ${u.name} (was ${currentStatus})`);
            }
          }
        }
      }

      // Update status if changed
      if (newStatus !== currentStatus) {
        console.log(`Unit ${u.name}: ${currentStatus} -> ${newStatus} (${reason})`);
        
        const { error: updateError } = await supabase
          .from("units")
          .update({
            status: newStatus,
            last_status_change: new Date().toISOString(),
          })
          .eq("id", u.id);

        if (updateError) {
          console.error(`Error updating unit ${u.id}:`, updateError);
          continue;
        }

        stateChanges.push({
          unitId: u.id as string,
          from: currentStatus,
          to: newStatus,
          reason,
        });

        // Create alert for monitoring_interrupted/manual_required
        if (["monitoring_interrupted", "manual_required", "offline"].includes(newStatus)) {
          const { data: existingAlert } = await supabase
            .from("alerts")
            .select("id")
            .eq("unit_id", u.id)
            .eq("alert_type", "monitoring_interrupted")
            .in("status", ["active", "acknowledged"])
            .maybeSingle();

          if (!existingAlert) {
            const { data: alertData } = await supabase.from("alerts").insert({
              unit_id: u.id,
              organization_id: getOrgId(unit),
              site_id: getSiteId(unit),
              area_id: getAreaId(unit),
              source: "sensor",
              title: `${u.name}: Monitoring Interrupted`,
              message: reason,
              alert_type: "monitoring_interrupted",
              severity: "info",
            }).select("id").single();

            if (alertData) {
              newAlertIds.push(alertData.id);
              console.log(`Created monitoring_interrupted alert for unit ${u.name}`);
            }
          }
        }

        // Log state change to event_logs
        await supabase.from("event_logs").insert({
          organization_id: getOrgId(unit),
          site_id: getSiteId(unit),
          unit_id: u.id,
          event_type: "unit_state_change",
          category: "unit",
          severity: newStatus === "alarm_active" ? "error" : newStatus === "excursion" ? "warning" : "info",
          title: `${u.name}: ${currentStatus} → ${newStatus}`,
          event_data: {
            from_status: currentStatus,
            to_status: newStatus,
            reason,
            temp_reading: u.last_temp_reading,
            door_state: doorState,
          },
        });
      }
    }

    // Trigger escalation processing if there are new alerts
    if (newAlertIds.length > 0) {
      console.log(`Triggering escalation processing for ${newAlertIds.length} new alerts`);
      
      const internalApiKey = Deno.env.get("INTERNAL_API_KEY");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      
      try {
        await fetch(`${supabaseUrl}/functions/v1/process-escalations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(internalApiKey ? { "X-Internal-API-Key": internalApiKey } : {}),
          },
          body: JSON.stringify({ alert_ids: newAlertIds }),
        });
      } catch (err) {
        console.error("Failed to trigger escalation processing:", err);
      }
    }

    console.log(`Process complete: ${stateChanges.length} state changes, ${newAlertIds.length} new alerts`);

    return new Response(
      JSON.stringify({
        success: true,
        stateChanges: stateChanges.length,
        newAlerts: newAlertIds.length,
        changes: stateChanges,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing unit states:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
