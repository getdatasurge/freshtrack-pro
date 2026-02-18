import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateInternalApiKey, unauthorizedResponse } from "../_shared/validation.ts";
import { STORAGE_UNIT, getUnitSymbol } from "../_shared/unitConversion.ts";

// Unit symbol for storage unit (used in log messages)
const TEMP_UNIT_SYMBOL = getUnitSymbol(STORAGE_UNIT);

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
  last_checkin_at: string | null;
  checkin_interval_minutes: number;
  temp_limit_high: number;
  temp_limit_low: number | null;
  temp_hysteresis: number;
  manual_log_cadence: number;
  last_manual_log_at: string | null;
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

/**
 * Compute the number of missed check-ins based on last_checkin_at and interval
 * Uses a 30-second buffer to avoid flapping
 */
function computeMissedCheckins(lastCheckinAt: string | null, intervalMinutes: number): number {
  if (!lastCheckinAt) return 0;
  const elapsed = Date.now() - new Date(lastCheckinAt).getTime();
  const intervalMs = intervalMinutes * 60 * 1000;
  // Add 30-second buffer to avoid flapping
  const bufferedElapsed = Math.max(0, elapsed - 30000);
  return Math.max(0, Math.floor(bufferedElapsed / intervalMs));
}

/**
 * Determine offline severity based on missed check-ins
 */
function computeOfflineSeverity(
  missedCheckins: number,
  warningThreshold: number,
  criticalThreshold: number
): "none" | "warning" | "critical" {
  if (missedCheckins >= criticalThreshold) return "critical";
  if (missedCheckins >= warningThreshold) return "warning";
  return "none";
}

/**
 * Check if manual logging is required
 * Requirements: missed check-ins >= threshold AND time since last reading > cadence
 */
function isManualLoggingRequired(
  missedCheckins: number,
  missedCheckinThreshold: number,
  lastReadingAt: string | null,
  lastManualLogAt: string | null,
  manualCadenceMinutes: number,
  graceMinutes: number
): boolean {
  // Must have missed enough check-ins first
  if (missedCheckins < missedCheckinThreshold) return false;
  
  // Find the most recent valid reading (sensor or manual)
  const lastSensorTime = lastReadingAt ? new Date(lastReadingAt).getTime() : 0;
  const lastManualTime = lastManualLogAt ? new Date(lastManualLogAt).getTime() : 0;
  const lastKnownGoodTime = Math.max(lastSensorTime, lastManualTime);
  
  if (lastKnownGoodTime === 0) return true; // No readings ever, manual required
  
  const now = Date.now();
  const cadenceMs = (manualCadenceMinutes + graceMinutes) * 60 * 1000;
  const timeSinceLastGood = now - lastKnownGoodTime;
  
  return timeSinceLastGood > cadenceMs;
}

/**
 * Check if an alert type is suppressed for a given unit/site/org.
 * Returns true if there's an active suppression that covers this alert type.
 * Uses a cache to avoid repeated DB queries per unit.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const suppressionCache = new Map<string, { types: string[]; id: string }[]>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isAlertSuppressed(
  supabase: any,
  unitId: string,
  siteId: string,
  orgId: string,
  alertType: string
): Promise<boolean> {
  const cacheKey = `${unitId}:${siteId}:${orgId}`;
  if (!suppressionCache.has(cacheKey)) {
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("alert_suppressions")
      .select("id, alert_types, unit_id, site_id, organization_id")
      .or(`unit_id.eq.${unitId},site_id.eq.${siteId},and(unit_id.is.null,site_id.is.null,organization_id.eq.${orgId})`)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso);

    suppressionCache.set(
      cacheKey,
      (data || []).map((s: { id: string; alert_types: string[] }) => ({
        types: s.alert_types || [],
        id: s.id,
      }))
    );
  }

  const suppressions = suppressionCache.get(cacheKey) || [];
  return suppressions.some(
    (s) => s.types.length === 0 || s.types.includes(alertType)
  );
}

/**
 * Correlate a newly created alert with related active alerts on the same unit.
 * Sets correlated_with_alert_id on the new alert if a relationship is found.
 *
 * Correlation rules:
 * - temp_excursion → correlates with active door_open on same unit
 * - suspected_cooling_failure → correlates with active temp_excursion on same unit
 * - monitoring_interrupted → correlates with first monitoring_interrupted at same site (within 5 min)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function correlateAlert(
  supabase: any,
  newAlertId: string,
  alertType: string,
  unitId: string,
  siteId: string,
  orgId: string
): Promise<void> {
  try {
    let correlationTarget: string | null = null;

    if (alertType === "temp_excursion") {
      // Correlate with active door_open on same unit
      const { data } = await supabase
        .from("alerts")
        .select("id")
        .eq("unit_id", unitId)
        .eq("alert_type", "door_open")
        .in("status", ["active", "acknowledged"])
        .order("triggered_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) correlationTarget = data.id;
    } else if (alertType === "suspected_cooling_failure") {
      // Correlate with active temp_excursion on same unit
      const { data } = await supabase
        .from("alerts")
        .select("id")
        .eq("unit_id", unitId)
        .eq("alert_type", "temp_excursion")
        .in("status", ["active", "acknowledged"])
        .order("triggered_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) correlationTarget = data.id;
    } else if (alertType === "monitoring_interrupted") {
      // Correlate with another monitoring_interrupted at same site within 5 min
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("alerts")
        .select("id")
        .eq("site_id", siteId)
        .eq("alert_type", "monitoring_interrupted")
        .in("status", ["active", "acknowledged"])
        .neq("id", newAlertId)
        .neq("unit_id", unitId)
        .gte("triggered_at", fiveMinAgo)
        .order("triggered_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) correlationTarget = data.id;
    }

    if (correlationTarget) {
      await supabase
        .from("alerts")
        .update({ correlated_with_alert_id: correlationTarget })
        .eq("id", newAlertId);

      // Log correlation to audit log
      try {
        await supabase.from("alert_audit_log").insert({
          alert_id: newAlertId,
          organization_id: orgId,
          event_type: "correlated",
          actor_type: "system",
          details: {
            correlated_with: correlationTarget,
            alert_type: alertType,
            reason: alertType === "monitoring_interrupted" ? "site_wide_outage" : "causal_chain",
          },
        });
      } catch {
        // Audit log insert is best-effort
      }

      console.log(`Correlated alert ${newAlertId} (${alertType}) → ${correlationTarget}`);
    }
  } catch (err) {
    console.error(`Correlation check failed for alert ${newAlertId}:`, err);
  }
}

/**
 * Process Unit States - Internal Scheduled Function
 *
 * Security: Requires INTERNAL_API_KEY when configured
 *
 * This function processes all active units to:
 * - Detect offline status based on missed check-ins (WARNING at 1, CRITICAL at 5)
 * - Trigger manual_required only when 5+ missed check-ins AND 4+ hours since last reading
 * - Detect temperature excursions and create alerts
 * - Track door states and grace periods
 * - Detect suspected cooling failures
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Clear suppression cache for each invocation
  suppressionCache.clear();

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

    console.log("Processing unit states with missed check-in logic...");

    // Get all active units with all required fields
    const { data: units, error: unitsError } = await supabase
      .from("units")
      .select(`
        id, name, status, last_reading_at, last_temp_reading, area_id,
        last_checkin_at, checkin_interval_minutes, last_manual_log_at,
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
      const unitId = u.id as string;
      let newStatus: UnitStatus = currentStatus;
      let reason = "";

      const lastReadingAt = u.last_reading_at as string | null;
      const lastCheckinAt = u.last_checkin_at as string | null;
      const lastManualLogAt = u.last_manual_log_at as string | null;
      const checkinIntervalMinutes = (u.checkin_interval_minutes as number) || 5;
      const manualLogCadence = u.manual_log_cadence as number || 14400; // seconds
      const manualCadenceMinutes = Math.floor(manualLogCadence / 60); // Convert to minutes

      const lastReadingTime = lastReadingAt ? new Date(lastReadingAt).getTime() : null;
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
      const confirmTimeDoorClosed = ((u.confirm_time_door_closed as number) || 600) * 1000;
      const confirmTimeDoorOpen = ((u.confirm_time_door_open as number) || 1200) * 1000;
      const confirmTime = doorState === "open" ? confirmTimeDoorOpen : confirmTimeDoorClosed;

      // Get per-unit alert rules for thresholds
      const { data: effectiveRules } = await supabase.rpc("get_effective_alert_rules", { p_unit_id: u.id });
      const rules = effectiveRules as Record<string, unknown> | null;
      
      // Extract thresholds from effective rules
      const offlineWarningThreshold = (rules?.offline_warning_missed_checkins as number) ?? 1;
      const offlineCriticalThreshold = (rules?.offline_critical_missed_checkins as number) ?? 5;
      const manualLogMissedThreshold = (rules?.manual_log_missed_checkins_threshold as number) ?? 5;
      const manualIntervalMinutes = (rules?.manual_interval_minutes as number) ?? 240; // 4 hours default
      const manualGraceMinutes = (rules?.manual_grace_minutes as number) ?? 0;

      // === MISSED CHECK-IN BASED OFFLINE DETECTION ===
      const missedCheckins = computeMissedCheckins(lastCheckinAt, checkinIntervalMinutes);
      const offlineSeverity = computeOfflineSeverity(missedCheckins, offlineWarningThreshold, offlineCriticalThreshold);
      
      // Check if manual logging is required (5+ missed check-ins AND 4+ hours since last reading)
      const manualRequired = isManualLoggingRequired(
        missedCheckins,
        manualLogMissedThreshold,
        lastReadingAt,
        lastManualLogAt,
        manualIntervalMinutes,
        manualGraceMinutes
      );

      // === STATE TRANSITIONS BASED ON MISSED CHECK-INS ===
      
      // Handle offline states
      if (offlineSeverity === "critical") {
        if (manualRequired) {
          // Critical offline AND manual logging required
          if (currentStatus !== "manual_required") {
            newStatus = "manual_required";
            reason = `${missedCheckins} missed check-ins (critical) + manual logging required (>${manualIntervalMinutes}m since last reading)`;
          }
        } else {
          // Critical offline but manual logging NOT required (within 4 hours)
          if (currentStatus !== "monitoring_interrupted" && currentStatus !== "manual_required") {
            newStatus = "monitoring_interrupted";
            reason = `${missedCheckins} missed check-ins - critical offline (manual logging not yet required, last reading within ${manualIntervalMinutes}m)`;
          }
        }
      } else if (offlineSeverity === "warning") {
        // Warning-level offline (1-4 missed check-ins)
        // Only transition to offline state if not in a more severe state
        if (currentStatus === "ok" || currentStatus === "restoring") {
          newStatus = "offline";
          reason = `${missedCheckins} missed check-in(s) - warning level offline`;
        }
      }

      // === CHECK FOR DATA RECOVERY ===
      // If we have recent data (check-in within 1 interval), transition back
      if (missedCheckins === 0 && offlineSeverity === "none") {
        if (currentStatus === "offline" || currentStatus === "monitoring_interrupted" || currentStatus === "manual_required") {
          newStatus = "restoring";
          reason = "Sensor data restored - transitioning to restoring";
          
          // Resolve monitoring_interrupted alert
          await supabase
            .from("alerts")
            .update({
              status: "resolved",
              resolved_at: new Date().toISOString(),
              resolution_type: "auto",
            })
            .eq("unit_id", u.id)
            .eq("alert_type", "monitoring_interrupted")
            .in("status", ["active", "acknowledged"]);
          
          console.log(`Resolved monitoring_interrupted alerts for unit ${u.name}`);
        }
      }

      // === TEMPERATURE EXCURSION LOGIC ===
      // All temperatures are in storage unit (°F) - both readings and thresholds
      // This ensures unit-correct alarm evaluation
      if (missedCheckins === 0 && u.last_temp_reading !== null) {
        const temp = u.last_temp_reading as number; // In storage unit (°F)
        const highLimit = u.temp_limit_high as number; // In storage unit (°F)
        const lowLimit = u.temp_limit_low as number | null; // In storage unit (°F)
        const hysteresis = u.temp_hysteresis as number;

        const isAboveLimit = temp > highLimit;
        const isBelowLimit = lowLimit !== null && temp < lowLimit;

        if (isAboveLimit || isBelowLimit) {
          // Temperature out of range
          if (isDoorOpenWithinGrace && currentStatus === "ok") {
            console.log(`Unit ${u.name}: Temp out of range but door open (${doorOpenDuration}/${doorGraceMinutes}m grace)`);
          } else if (currentStatus === "ok" || currentStatus === "restoring") {
            newStatus = "excursion";
            reason = `Temperature ${temp}${TEMP_UNIT_SYMBOL} ${isAboveLimit ? "above" : "below"} limit${doorState === "open" ? " (door open)" : ""}`;
          } else if (currentStatus === "excursion") {
            const statusChangeTime = u.last_status_change ? new Date(u.last_status_change as string).getTime() : now;
            const timeInExcursion = now - statusChangeTime;

            if (timeInExcursion >= confirmTime) {
              newStatus = "alarm_active";
              reason = `Temperature excursion confirmed after ${Math.floor(timeInExcursion / 60000)}m: ${temp}${TEMP_UNIT_SYMBOL} (door ${doorState})`;
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

            if (!existingAlert && !(await isAlertSuppressed(supabase, unitId, getSiteId(unit), getOrgId(unit), "temp_excursion"))) {
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
                  temp_unit: STORAGE_UNIT, // Document the unit for display conversion
                  low_limit: lowLimit,
                  high_limit: highLimit,
                  reading_source: "sensor",
                  reading_at: u.last_reading_at,
                  door_state: doorState,
                },
              }).select("id").single();
              
              if (!alertError && alertData) {
                newAlertIds.push(alertData.id);
                await correlateAlert(supabase, alertData.id, "temp_excursion", unitId, getSiteId(unit), getOrgId(unit));
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
                message: `Temperature excursion confirmed: ${temp}${TEMP_UNIT_SYMBOL} after ${durationMinutes}m`,
                metadata: {
                  current_temp: temp,
                  temp_unit: STORAGE_UNIT, // Document the unit for display conversion
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

                  if (!existingAlert && !(await isAlertSuppressed(supabase, unitId, getSiteId(unit), getOrgId(unit), "suspected_cooling_failure"))) {
                    const { data: alertData } = await supabase.from("alerts").insert({
                      unit_id: u.id,
                      organization_id: getOrgId(unit),
                      site_id: getSiteId(unit),
                      area_id: getAreaId(unit),
                      source: "sensor",
                      title: `${u.name}: Suspected Cooling Failure`,
                      message: `Door closed; temp not recovering; possible cooling system issue. Current: ${temp}${TEMP_UNIT_SYMBOL}`,
                      alert_type: "suspected_cooling_failure",
                      severity: "warning",
                      temp_reading: temp,
                      temp_limit: highLimit,
                      metadata: {
                        current_temp: temp,
                        temp_unit: STORAGE_UNIT,
                        high_limit: highLimit,
                        low_limit: lowLimit,
                      },
                    }).select("id").single();
                    
                    if (alertData) {
                      newAlertIds.push(alertData.id);
                      await correlateAlert(supabase, alertData.id, "suspected_cooling_failure", unitId, getSiteId(unit), getOrgId(unit));
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
                  resolution_type: "auto",
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
                  resolution_type: "auto",
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
            }
          }
        }
      }

      // === DOOR LEFT OPEN ALERT ===
      // Creates door_open alerts based on configurable time thresholds
      if (doorState === "open" && doorLastChanged) {
        const doorWarningMinutes = (rules?.door_open_warning_minutes as number) ?? 3;
        const doorCriticalMinutes = (rules?.door_open_critical_minutes as number) ?? 10;

        const { data: existingDoorAlert } = await supabase
          .from("alerts")
          .select("id, severity")
          .eq("unit_id", u.id)
          .eq("alert_type", "door_open")
          .in("status", ["active", "acknowledged"])
          .maybeSingle();

        if (doorOpenDuration >= doorCriticalMinutes) {
          if (!existingDoorAlert && !(await isAlertSuppressed(supabase, unitId, getSiteId(unit), getOrgId(unit), "door_open"))) {
            const { data: alertData } = await supabase.from("alerts").insert({
              unit_id: u.id,
              organization_id: getOrgId(unit),
              site_id: getSiteId(unit),
              area_id: getAreaId(unit),
              source: "sensor",
              title: `${u.name}: Door Open ${doorOpenDuration} min`,
              message: `Door has been open for ${doorOpenDuration} minutes (critical threshold: ${doorCriticalMinutes} min)`,
              alert_type: "door_open",
              severity: "critical",
              metadata: {
                duration_minutes: doorOpenDuration,
                warning_threshold: doorWarningMinutes,
                critical_threshold: doorCriticalMinutes,
                door_last_changed_at: u.door_last_changed_at,
              },
            }).select("id").single();
            if (alertData) {
              newAlertIds.push(alertData.id);
              console.log(`Created door_open alert (CRITICAL) for unit ${u.name} — ${doorOpenDuration}m`);
            }
          } else if (existingDoorAlert && existingDoorAlert.severity !== "critical") {
            await supabase.from("alerts").update({
              severity: "critical",
              title: `${u.name}: Door Open ${doorOpenDuration} min`,
              message: `Door has been open for ${doorOpenDuration} minutes (critical threshold: ${doorCriticalMinutes} min)`,
              metadata: { duration_minutes: doorOpenDuration, warning_threshold: doorWarningMinutes, critical_threshold: doorCriticalMinutes },
            }).eq("id", existingDoorAlert.id);
            console.log(`Escalated door_open alert to critical for unit ${u.name}`);
          }
        } else if (doorOpenDuration >= doorWarningMinutes) {
          if (!existingDoorAlert && !(await isAlertSuppressed(supabase, unitId, getSiteId(unit), getOrgId(unit), "door_open"))) {
            const { data: alertData } = await supabase.from("alerts").insert({
              unit_id: u.id,
              organization_id: getOrgId(unit),
              site_id: getSiteId(unit),
              area_id: getAreaId(unit),
              source: "sensor",
              title: `${u.name}: Door Open ${doorOpenDuration} min`,
              message: `Door has been open for ${doorOpenDuration} minutes (warning threshold: ${doorWarningMinutes} min)`,
              alert_type: "door_open",
              severity: "warning",
              metadata: {
                duration_minutes: doorOpenDuration,
                warning_threshold: doorWarningMinutes,
                critical_threshold: doorCriticalMinutes,
                door_last_changed_at: u.door_last_changed_at,
              },
            }).select("id").single();
            if (alertData) {
              newAlertIds.push(alertData.id);
              console.log(`Created door_open alert (WARNING) for unit ${u.name} — ${doorOpenDuration}m`);
            }
          }
        }
      } else if (doorState === "closed" || doorState === "unknown") {
        // Auto-resolve door_open alerts when door closes
        const { data: activeDoorAlerts } = await supabase
          .from("alerts")
          .select("id")
          .eq("unit_id", u.id)
          .eq("alert_type", "door_open")
          .in("status", ["active", "acknowledged"]);

        if (activeDoorAlerts && activeDoorAlerts.length > 0) {
          await supabase
            .from("alerts")
            .update({
              status: "resolved",
              resolved_at: new Date().toISOString(),
              resolution_type: "auto",
            })
            .eq("unit_id", u.id)
            .eq("alert_type", "door_open")
            .in("status", ["active", "acknowledged"]);
          console.log(`Auto-resolved door_open alert for unit ${u.name} — door closed`);
        }
      }

      // === LOW BATTERY ALERT ===
      // Check sensors assigned to this unit for low battery
      {
        const { data: sensors } = await supabase
          .from("lora_sensors")
          .select("id, dev_eui, name, battery_level, battery_voltage, sensor_catalog_id")
          .eq("unit_id", u.id)
          .is("deleted_at", null);

        if (sensors && sensors.length > 0) {
          for (const sensor of sensors) {
            const batteryLevel = sensor.battery_level as number | null;
            const batteryVoltage = sensor.battery_voltage as number | null;

            // Determine low battery threshold
            let lowThresholdV = 2.5; // Default voltage threshold
            if (sensor.sensor_catalog_id) {
              const { data: catalog } = await supabase
                .from("sensor_catalog")
                .select("battery_info")
                .eq("id", sensor.sensor_catalog_id)
                .maybeSingle();
              if (catalog?.battery_info) {
                const info = catalog.battery_info as { low_threshold_v?: number };
                if (info.low_threshold_v) lowThresholdV = info.low_threshold_v;
              }
            }

            const isLowByVoltage = batteryVoltage !== null && batteryVoltage > 0 && batteryVoltage < lowThresholdV;
            const isLowByLevel = batteryLevel !== null && batteryLevel > 0 && batteryLevel <= 10; // 10% or below

            if (isLowByVoltage || isLowByLevel) {
              const { data: existingAlert } = await supabase
                .from("alerts")
                .select("id")
                .eq("unit_id", u.id)
                .eq("alert_type", "low_battery")
                .eq("sensor_dev_eui", sensor.dev_eui)
                .in("status", ["active", "acknowledged"])
                .maybeSingle();

              if (!existingAlert && !(await isAlertSuppressed(supabase, unitId, getSiteId(unit), getOrgId(unit), "low_battery"))) {
                const voltageStr = batteryVoltage !== null ? `${batteryVoltage.toFixed(2)}V` : "N/A";
                const levelStr = batteryLevel !== null ? `${batteryLevel}%` : "N/A";
                const { data: alertData } = await supabase.from("alerts").insert({
                  unit_id: u.id,
                  organization_id: getOrgId(unit),
                  site_id: getSiteId(unit),
                  area_id: getAreaId(unit),
                  source: "sensor",
                  sensor_dev_eui: sensor.dev_eui,
                  title: `${sensor.name || u.name}: Low Battery`,
                  message: `Battery low (${levelStr}, ${voltageStr}). Schedule replacement within 2 weeks.`,
                  alert_type: "low_battery",
                  severity: "warning",
                  metadata: {
                    battery_level: batteryLevel,
                    battery_voltage: batteryVoltage,
                    low_threshold_v: lowThresholdV,
                    sensor_id: sensor.id,
                    sensor_name: sensor.name,
                    sensor_dev_eui: sensor.dev_eui,
                  },
                }).select("id").single();
                if (alertData) {
                  newAlertIds.push(alertData.id);
                  console.log(`Created low_battery alert for sensor ${sensor.name} on unit ${u.name}`);
                }
              }
            } else if (batteryLevel !== null && batteryLevel > 20) {
              // Auto-resolve low battery if battery is now healthy (e.g., replaced)
              await supabase
                .from("alerts")
                .update({
                  status: "resolved",
                  resolved_at: new Date().toISOString(),
                  resolution_type: "auto",
                })
                .eq("unit_id", u.id)
                .eq("alert_type", "low_battery")
                .eq("sensor_dev_eui", sensor.dev_eui)
                .in("status", ["active", "acknowledged"]);
            }
          }
        }
      }

      // === SENSOR FAULT ALERT ===
      // Check most recent reading for error flags or impossible values
      {
        const { data: latestReading } = await supabase
          .from("sensor_readings")
          .select("temperature, humidity, source_metadata, recorded_at, lora_sensor_id")
          .eq("unit_id", u.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestReading) {
          const temp = latestReading.temperature as number | null;
          const meta = (latestReading.source_metadata || {}) as Record<string, unknown>;
          const decoderErrors = meta.decoder_errors as string[] | undefined;

          // Detect sensor faults:
          // 1. Impossible temperature values (sensor reports 0x7FFF / 327.67°C = 621.8°F or -40°F minimum)
          // 2. Decoder errors from ttn-webhook
          // 3. Temperature exactly 0 with humidity exactly 0 (common fault pattern)
          const isImpossibleTemp = temp !== null && (temp > 300 || temp < -100);
          const hasDecoderErrors = decoderErrors && decoderErrors.length > 0;
          const isSensorFault = isImpossibleTemp || hasDecoderErrors;

          if (isSensorFault) {
            const sensorId = latestReading.lora_sensor_id as string | null;
            let sensorDevEui: string | null = null;
            let sensorName: string | null = null;

            if (sensorId) {
              const { data: sensor } = await supabase
                .from("lora_sensors")
                .select("dev_eui, name")
                .eq("id", sensorId)
                .maybeSingle();
              sensorDevEui = sensor?.dev_eui || null;
              sensorName = sensor?.name || null;
            }

            const { data: existingAlert } = await supabase
              .from("alerts")
              .select("id")
              .eq("unit_id", u.id)
              .eq("alert_type", "sensor_fault")
              .in("status", ["active", "acknowledged"])
              .maybeSingle();

            if (!existingAlert && !(await isAlertSuppressed(supabase, unitId, getSiteId(unit), getOrgId(unit), "sensor_fault"))) {
              const faultReason = isImpossibleTemp
                ? `Impossible temperature reading: ${temp}${TEMP_UNIT_SYMBOL}`
                : `Decoder errors: ${(decoderErrors || []).join(", ")}`;

              const { data: alertData } = await supabase.from("alerts").insert({
                unit_id: u.id,
                organization_id: getOrgId(unit),
                site_id: getSiteId(unit),
                area_id: getAreaId(unit),
                source: "sensor",
                sensor_dev_eui: sensorDevEui,
                title: `${sensorName || u.name}: Sensor Fault`,
                message: `Hardware error detected. ${faultReason}. Manual monitoring required.`,
                alert_type: "sensor_fault",
                severity: "critical",
                metadata: {
                  fault_reason: faultReason,
                  impossible_temp: isImpossibleTemp,
                  decoder_errors: decoderErrors,
                  raw_temperature: temp,
                  sensor_id: sensorId,
                  sensor_name: sensorName,
                  sensor_dev_eui: sensorDevEui,
                  reading_at: latestReading.recorded_at,
                },
              }).select("id").single();
              if (alertData) {
                newAlertIds.push(alertData.id);
                console.log(`Created sensor_fault alert (CRITICAL) for unit ${u.name}`);
              }
            }
          } else {
            // Auto-resolve sensor_fault if readings are now normal
            await supabase
              .from("alerts")
              .update({
                status: "resolved",
                resolved_at: new Date().toISOString(),
                resolution_type: "auto",
              })
              .eq("unit_id", u.id)
              .eq("alert_type", "sensor_fault")
              .in("status", ["active", "acknowledged"]);
          }
        }
      }

      // === MISSED MANUAL ENTRY ALERT ===
      // Separate from monitoring_interrupted — fires when sensor is offline 4+ hours AND no manual log
      if (manualRequired && newStatus === "manual_required") {
        const { data: existingManualAlert } = await supabase
          .from("alerts")
          .select("id")
          .eq("unit_id", u.id)
          .eq("alert_type", "missed_manual_entry")
          .in("status", ["active", "acknowledged"])
          .maybeSingle();

        if (!existingManualAlert && !(await isAlertSuppressed(supabase, unitId, getSiteId(unit), getOrgId(unit), "missed_manual_entry"))) {
          const lastLogTime = lastManualLogAt
            ? new Date(lastManualLogAt).toLocaleString("en-US", { timeStyle: "short", dateStyle: "short" })
            : "never";
          const { data: alertData } = await supabase.from("alerts").insert({
            unit_id: u.id,
            organization_id: getOrgId(unit),
            site_id: getSiteId(unit),
            area_id: getAreaId(unit),
            source: "system",
            title: `${u.name}: Manual Temp Log Overdue`,
            message: `Manual temperature log required. Last entry: ${lastLogTime}. Monitoring has been interrupted for ${missedCheckins} check-ins.`,
            alert_type: "missed_manual_entry",
            severity: "warning",
            metadata: {
              missed_checkins: missedCheckins,
              manual_cadence_minutes: manualCadenceMinutes,
              last_manual_log_at: lastManualLogAt,
              last_reading_at: lastReadingAt,
            },
          }).select("id").single();
          if (alertData) {
            newAlertIds.push(alertData.id);
            console.log(`Created missed_manual_entry alert for unit ${u.name}`);
          }
        }
      } else if (!manualRequired) {
        // Auto-resolve missed_manual_entry when a manual log is submitted or sensor comes back
        await supabase
          .from("alerts")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            resolution_type: "auto",
          })
          .eq("unit_id", u.id)
          .eq("alert_type", "missed_manual_entry")
          .in("status", ["active", "acknowledged"]);
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

        // Create alert for offline states with appropriate severity
        if (["monitoring_interrupted", "manual_required", "offline"].includes(newStatus)) {
          const { data: existingAlert } = await supabase
            .from("alerts")
            .select("id, severity")
            .eq("unit_id", u.id)
            .eq("alert_type", "monitoring_interrupted")
            .in("status", ["active", "acknowledged"])
            .maybeSingle();

          // Determine alert severity based on offline severity
          const alertSeverity = offlineSeverity === "critical" ? "critical" : "warning";

          if (!existingAlert && !(await isAlertSuppressed(supabase, unitId, getSiteId(unit), getOrgId(unit), "monitoring_interrupted"))) {
            const { data: alertData } = await supabase.from("alerts").insert({
              unit_id: u.id,
              organization_id: getOrgId(unit),
              site_id: getSiteId(unit),
              area_id: getAreaId(unit),
              source: "sensor",
              title: newStatus === "manual_required" 
                ? `${u.name}: Manual Logging Required`
                : `${u.name}: Monitoring Interrupted`,
              message: reason,
              alert_type: "monitoring_interrupted",
              severity: alertSeverity,
              metadata: {
                missed_checkins: missedCheckins,
                offline_severity: offlineSeverity,
                manual_required: manualRequired,
              },
            }).select("id").single();

            if (alertData) {
              newAlertIds.push(alertData.id);
              await correlateAlert(supabase, alertData.id, "monitoring_interrupted", unitId, getSiteId(unit), getOrgId(unit));
              console.log(`Created monitoring_interrupted alert (${alertSeverity}) for unit ${u.name}`);
            }
          } else if (existingAlert && existingAlert.severity !== alertSeverity) {
            // Update existing alert severity if it changed
            await supabase
              .from("alerts")
              .update({
                severity: alertSeverity,
                title: newStatus === "manual_required" 
                  ? `${u.name}: Manual Logging Required`
                  : `${u.name}: Monitoring Interrupted`,
                message: reason,
                metadata: {
                  missed_checkins: missedCheckins,
                  offline_severity: offlineSeverity,
                  manual_required: manualRequired,
                },
              })
              .eq("id", existingAlert.id);
            
            console.log(`Updated monitoring_interrupted alert to ${alertSeverity} for unit ${u.name}`);
          }
        }

        // Log state change to event_logs
        await supabase.from("event_logs").insert({
          organization_id: getOrgId(unit),
          site_id: getSiteId(unit),
          unit_id: u.id,
          event_type: "unit_state_change",
          category: "unit",
          severity: newStatus === "alarm_active" ? "error" : 
                   (newStatus === "excursion" || newStatus === "manual_required") ? "warning" : "info",
          title: `${u.name}: ${currentStatus} → ${newStatus}`,
          event_data: {
            from_status: currentStatus,
            to_status: newStatus,
            reason,
            temp_reading: u.last_temp_reading,
            door_state: doorState,
            missed_checkins: missedCheckins,
            offline_severity: offlineSeverity,
            manual_required: manualRequired,
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
