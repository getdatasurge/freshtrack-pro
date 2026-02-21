/**
 * Evaluate Alarms Edge Function — FrostGuard Alarm Engine
 *
 * Evaluates all applicable alarm definitions against the latest sensor reading
 * for a given unit. Called as fire-and-forget from ttn-webhook after each uplink.
 *
 * Detection Tiers:
 *   T1 — Single-sensor threshold facts (temp range, battery, signal)
 *   T2 — Time-series patterns (rate of change, sustained, oscillation)
 *   T3 — Multi-sensor correlation (door+temp, tvoc+temp)
 *   T4 — Site-wide patterns (multi-unit comparison)
 *   T5 — Environmental thresholds (CO2, TVOC, leak)
 *
 * Writes:
 *   alarm_events       — fired alarm instances
 *   alarm_evaluation_log — every evaluation for comparison/audit
 *   alerts             — bridge row so process-escalations picks it up
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-api-key",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvalRequest {
  unit_id: string;
  org_id: string;
  site_id?: string;
  dev_eui?: string;
  temperature?: number;      // °F (storage unit)
  humidity?: number;
  battery_level?: number;
  battery_voltage?: number;
  signal_strength?: number;  // RSSI dBm
  door_open?: boolean;
  door_state?: string;       // 'open' | 'closed'
  recorded_at: string;       // ISO timestamp of reading
  reading_id?: string;
}

interface AlarmDef {
  id: string;
  slug: string;
  display_name: string;
  category: string;
  subcategory: string;
  severity: string;
  detection_tier: string;
  eval_field: string | null;
  eval_logic: string | null;
  eval_params: Record<string, unknown>;
  threshold_min: number | null;
  threshold_max: number | null;
  threshold_unit: string | null;
  duration_minutes: number | null;
  cooldown_minutes: number | null;
  enabled_by_default: boolean;
  applicable_unit_types: string[];
  applicable_sensor_types: string[];
  notification_channels: string[];
  corrective_action_text: string | null;
  requires_corrective_action: boolean;
  ai_hints: string[];
}

interface EffectiveConfig {
  id: string;
  slug: string;
  display_name: string;
  severity: string;
  enabled: boolean;
  threshold_min: number | null;
  threshold_max: number | null;
  duration_minutes: number | null;
  cooldown_minutes: number | null;
  escalation_minutes: number | null;
  notification_channels: string[];
}

interface EvalResult {
  alarm: AlarmDef;
  config: EffectiveConfig;
  fired: boolean;
  trigger_value: number | null;
  reason: string;
  cooldown_active: boolean;
  dedup_hit: boolean;
  eval_detail: Record<string, unknown>;
  duration_ms: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inRange(
  value: number,
  min: number | null,
  max: number | null
): boolean {
  if (min !== null && max !== null) return value >= min && value <= max;
  if (min !== null) return value >= min;
  if (max !== null) return value <= max;
  return false;
}

function getFieldValue(
  field: string | null,
  req: EvalRequest
): number | boolean | string | null {
  if (!field) return null;
  switch (field) {
    case "last_temp_f":
      return req.temperature ?? null;
    case "last_humidity":
      return req.humidity ?? null;
    case "battery_pct":
      return req.battery_level ?? null;
    case "rssi_dbm":
      return req.signal_strength ?? null;
    case "door_state":
      return req.door_open !== undefined
        ? (req.door_open ? "open" : "closed")
        : (req.door_state ?? null);
    case "door_open":
      return req.door_open ?? null;
    case "co2_ppm":
      return null; // future: extract from reading
    case "tvoc_ppb":
      return null; // future: extract from reading
    case "water_leak":
      return null; // future
    case "ambient_temp_f":
      return null; // future
    case "light_lux":
      return null; // future
    case "motion_count":
      return null; // future
    case "alarm":
      return null; // future: tamper flag
    default:
      return null;
  }
}

// ─── T1 Evaluator: Single-reading threshold checks ───────────────────────────

function evaluateT1(
  alarm: AlarmDef,
  config: EffectiveConfig,
  req: EvalRequest
): { fired: boolean; trigger_value: number | null; reason: string; detail: Record<string, unknown> } {
  const field = alarm.eval_field;
  const raw = getFieldValue(field, req);

  // Normal-severity alarms are informational — never fire as alerts
  if (alarm.severity === "normal" || config.severity === "normal") {
    return { fired: false, trigger_value: null, reason: "normal_severity_skip", detail: {} };
  }

  // Door-based alarms with duration use door_state + duration check
  if (field === "door_state" && alarm.category === "door") {
    // Door duration alarms require historical lookup (handled in duration check path)
    // For T1 door alarms: only fire if door is currently open
    const doorOpen = req.door_open === true || req.door_state === "open";
    if (!doorOpen) {
      return { fired: false, trigger_value: null, reason: "door_closed", detail: { door_state: "closed" } };
    }
    // Duration check needed — signal that we can't fully evaluate in T1 without history
    // For T1 door alarms (door_open_warning, door_stuck_open, door_open_critical),
    // the ttn-webhook will be calling us on every uplink. We check door_events for duration.
    return {
      fired: true, // tentatively — caller must check duration separately
      trigger_value: null,
      reason: "door_open_duration_check_needed",
      detail: { door_state: "open", duration_check: true },
    };
  }

  if (raw === null || raw === undefined) {
    return { fired: false, trigger_value: null, reason: "field_null", detail: { field } };
  }

  if (typeof raw === "boolean") {
    // Boolean fields (water_leak, alarm flag)
    const fired = raw === true;
    return { fired, trigger_value: fired ? 1 : 0, reason: fired ? "boolean_true" : "boolean_false", detail: { field, value: raw } };
  }

  if (typeof raw !== "number") {
    return { fired: false, trigger_value: null, reason: "non_numeric", detail: { field, value: raw } };
  }

  const value = raw;
  const tMin = config.threshold_min ?? alarm.threshold_min;
  const tMax = config.threshold_max ?? alarm.threshold_max;

  if (tMin === null && tMax === null) {
    return { fired: false, trigger_value: value, reason: "no_thresholds", detail: { field, value } };
  }

  const fired = inRange(value, tMin, tMax);
  return {
    fired,
    trigger_value: value,
    reason: fired ? "threshold_match" : "within_normal",
    detail: { field, value, threshold_min: tMin, threshold_max: tMax },
  };
}

// ─── T2 Evaluator: Time-series patterns ──────────────────────────────────────

async function evaluateT2(
  supabase: ReturnType<typeof createClient>,
  alarm: AlarmDef,
  config: EffectiveConfig,
  req: EvalRequest
): Promise<{ fired: boolean; trigger_value: number | null; reason: string; detail: Record<string, unknown> }> {
  // Skip normal severity
  if (config.severity === "normal") {
    return { fired: false, trigger_value: null, reason: "normal_severity_skip", detail: {} };
  }

  const slug = alarm.slug;

  // Rate-of-change alarms
  if (slug === "temp_rising_fast" || slug === "temp_rising_slow") {
    if (req.temperature === undefined) {
      return { fired: false, trigger_value: null, reason: "no_temp", detail: {} };
    }
    // Fetch recent readings for rate calculation (last 2 hours)
    const { data: readings } = await supabase
      .from("sensor_readings")
      .select("temperature, recorded_at")
      .eq("unit_id", req.unit_id)
      .not("temperature", "is", null)
      .order("recorded_at", { ascending: false })
      .limit(20);

    if (!readings || readings.length < 2) {
      return { fired: false, trigger_value: null, reason: "insufficient_history", detail: { readings_count: readings?.length ?? 0 } };
    }

    // Calculate rate over the last hour
    const now = new Date(req.recorded_at).getTime();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentReadings = readings.filter(
      (r: { recorded_at: string }) => new Date(r.recorded_at).getTime() >= oneHourAgo
    );

    if (recentReadings.length < 2) {
      return { fired: false, trigger_value: null, reason: "insufficient_recent_history", detail: {} };
    }

    const oldest = recentReadings[recentReadings.length - 1];
    const newest = recentReadings[0];
    const timeDiffHrs =
      (new Date(newest.recorded_at).getTime() - new Date(oldest.recorded_at).getTime()) /
      (1000 * 60 * 60);

    if (timeDiffHrs < 0.1) {
      return { fired: false, trigger_value: null, reason: "time_span_too_short", detail: {} };
    }

    const ratePerHour = (newest.temperature - oldest.temperature) / timeDiffHrs;

    // temp_rising_fast: >5°F/hr
    // temp_rising_slow: 1-3°F/hr sustained
    const threshold = slug === "temp_rising_fast" ? 5 : 1;
    const maxThreshold = slug === "temp_rising_slow" ? 3 : Infinity;
    const fired = ratePerHour >= threshold && ratePerHour <= maxThreshold;

    return {
      fired,
      trigger_value: Math.round(ratePerHour * 100) / 100,
      reason: fired ? "rate_exceeded" : "rate_normal",
      detail: { rate_per_hour: ratePerHour, threshold, readings_used: recentReadings.length },
    };
  }

  // Sustained danger zone (temp_sustained_danger)
  if (slug === "temp_sustained_danger") {
    if (req.temperature === undefined) {
      return { fired: false, trigger_value: null, reason: "no_temp", detail: {} };
    }
    const tMin = config.threshold_min ?? 41;
    const tMax = config.threshold_max ?? 135;
    const durationMin = config.duration_minutes ?? 120;

    if (!inRange(req.temperature, tMin, tMax)) {
      return { fired: false, trigger_value: req.temperature, reason: "not_in_danger_zone", detail: { temperature: req.temperature, tMin, tMax } };
    }

    // Check if temp has been in this range for duration_minutes
    const cutoff = new Date(new Date(req.recorded_at).getTime() - durationMin * 60 * 1000).toISOString();
    const { data: readings } = await supabase
      .from("sensor_readings")
      .select("temperature, recorded_at")
      .eq("unit_id", req.unit_id)
      .not("temperature", "is", null)
      .gte("recorded_at", cutoff)
      .order("recorded_at", { ascending: true });

    if (!readings || readings.length < 3) {
      return { fired: false, trigger_value: req.temperature, reason: "insufficient_history", detail: {} };
    }

    const allInRange = readings.every(
      (r: { temperature: number }) => r.temperature >= tMin && r.temperature <= tMax
    );

    return {
      fired: allInRange,
      trigger_value: req.temperature,
      reason: allInRange ? "sustained_danger" : "not_sustained",
      detail: { readings_checked: readings.length, duration_min: durationMin, all_in_range: allInRange },
    };
  }

  // Sensor offline
  if (slug === "sensor_offline" || slug === "sensor_offline_24h") {
    // This is checked differently — based on last_seen_at of the sensor
    // For now, skip (sensor offline detection is better done by a cron job)
    return { fired: false, trigger_value: null, reason: "offline_check_deferred", detail: {} };
  }

  // Door duration alarms (door_rapid_cycling, door_after_hours, door_sensor_stuck)
  if (slug === "door_rapid_cycling" || slug === "door_after_hours" || slug === "door_sensor_stuck") {
    // These need specialized time-series analysis — defer to future iteration
    return { fired: false, trigger_value: null, reason: "t2_door_deferred", detail: {} };
  }

  // Humidity, oscillation, defrost, freeze-thaw, overnight — defer complex T2 patterns
  if (slug === "humidity_high") {
    if (req.humidity === undefined) {
      return { fired: false, trigger_value: null, reason: "no_humidity", detail: {} };
    }
    const tMin = config.threshold_min ?? 85;
    const tMax = config.threshold_max ?? 95;
    const fired = inRange(req.humidity, tMin, tMax);
    return { fired, trigger_value: req.humidity, reason: fired ? "humidity_high" : "humidity_normal", detail: { humidity: req.humidity, tMin, tMax } };
  }

  // temp_not_recovering
  if (slug === "temp_not_recovering") {
    if (req.temperature === undefined) {
      return { fired: false, trigger_value: null, reason: "no_temp", detail: {} };
    }
    const durationMin = config.duration_minutes ?? 120;
    const cutoff = new Date(new Date(req.recorded_at).getTime() - durationMin * 60 * 1000).toISOString();
    const { data: readings } = await supabase
      .from("sensor_readings")
      .select("temperature, recorded_at")
      .eq("unit_id", req.unit_id)
      .not("temperature", "is", null)
      .gte("recorded_at", cutoff)
      .order("recorded_at", { ascending: true });

    if (!readings || readings.length < 3) {
      return { fired: false, trigger_value: req.temperature, reason: "insufficient_history", detail: {} };
    }

    // Check if we have any alarm definitions for the unit's type to know what "above threshold" means
    // Simple heuristic: if all readings are above 41°F (generic fridge danger) and no downward trend
    const temps = readings.map((r: { temperature: number }) => r.temperature);
    const allAbove = temps.every((t: number) => t > 41);
    // Check for no recovery: latest temp >= oldest temp (not trending down)
    const noRecovery = temps[temps.length - 1] >= temps[0] - 1; // allow 1°F tolerance

    const fired = allAbove && noRecovery;
    return {
      fired,
      trigger_value: req.temperature,
      reason: fired ? "not_recovering" : "recovering_or_normal",
      detail: { temps_range: [temps[0], temps[temps.length - 1]], all_above_41: allAbove, no_recovery: noRecovery },
    };
  }

  // Default: defer unimplemented T2 patterns
  return { fired: false, trigger_value: null, reason: "t2_not_implemented", detail: { slug } };
}

// ─── T3 Evaluator: Multi-sensor correlation ──────────────────────────────────

async function evaluateT3(
  supabase: ReturnType<typeof createClient>,
  alarm: AlarmDef,
  config: EffectiveConfig,
  req: EvalRequest
): Promise<{ fired: boolean; trigger_value: number | null; reason: string; detail: Record<string, unknown> }> {
  if (config.severity === "normal") {
    return { fired: false, trigger_value: null, reason: "normal_severity_skip", detail: {} };
  }

  const slug = alarm.slug;

  if (slug === "door_closed_temp_rising") {
    // Door closed but temp rising >2°F/hr
    const doorClosed = req.door_open === false || req.door_state === "closed";
    if (!doorClosed || req.temperature === undefined) {
      return { fired: false, trigger_value: null, reason: doorClosed ? "no_temp" : "door_not_closed", detail: {} };
    }

    // Get rate of change
    const { data: readings } = await supabase
      .from("sensor_readings")
      .select("temperature, recorded_at")
      .eq("unit_id", req.unit_id)
      .not("temperature", "is", null)
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (!readings || readings.length < 2) {
      return { fired: false, trigger_value: null, reason: "insufficient_history", detail: {} };
    }

    const oldest = readings[readings.length - 1];
    const timeDiffHrs =
      (new Date(req.recorded_at).getTime() - new Date(oldest.recorded_at).getTime()) /
      (1000 * 60 * 60);

    if (timeDiffHrs < 0.1) {
      return { fired: false, trigger_value: null, reason: "time_span_too_short", detail: {} };
    }

    const ratePerHour = (req.temperature - oldest.temperature) / timeDiffHrs;
    const fired = ratePerHour > 2;

    return {
      fired,
      trigger_value: Math.round(ratePerHour * 100) / 100,
      reason: fired ? "door_closed_temp_rising" : "rate_normal",
      detail: { rate_per_hour: ratePerHour, door_closed: true },
    };
  }

  if (slug === "door_open_temp_rising") {
    const doorOpen = req.door_open === true || req.door_state === "open";
    if (!doorOpen || req.temperature === undefined) {
      return { fired: false, trigger_value: null, reason: "conditions_not_met", detail: {} };
    }

    // Check rate
    const { data: readings } = await supabase
      .from("sensor_readings")
      .select("temperature, recorded_at")
      .eq("unit_id", req.unit_id)
      .not("temperature", "is", null)
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (!readings || readings.length < 2) {
      return { fired: false, trigger_value: null, reason: "insufficient_history", detail: {} };
    }

    const oldest = readings[readings.length - 1];
    const timeDiffHrs =
      (new Date(req.recorded_at).getTime() - new Date(oldest.recorded_at).getTime()) /
      (1000 * 60 * 60);
    if (timeDiffHrs < 0.05) {
      return { fired: false, trigger_value: null, reason: "time_span_too_short", detail: {} };
    }

    const ratePerHour = (req.temperature - oldest.temperature) / timeDiffHrs;
    const fired = ratePerHour > 1; // lower threshold since door is open

    return {
      fired,
      trigger_value: Math.round(ratePerHour * 100) / 100,
      reason: fired ? "door_open_temp_rising" : "rate_normal",
      detail: { rate_per_hour: ratePerHour, door_open: true },
    };
  }

  if (slug === "post_close_no_recovery") {
    if (req.temperature === undefined) {
      return { fired: false, trigger_value: null, reason: "no_temp", detail: {} };
    }
    // Check if door was closed 30+ min ago but temp is still elevated
    const { data: doorEvents } = await supabase
      .from("door_events")
      .select("state, occurred_at")
      .eq("unit_id", req.unit_id)
      .order("occurred_at", { ascending: false })
      .limit(5);

    if (!doorEvents || doorEvents.length === 0) {
      return { fired: false, trigger_value: null, reason: "no_door_events", detail: {} };
    }

    // Find the last 'closed' event
    const lastClose = doorEvents.find((e: { state: string }) => e.state === "closed");
    if (!lastClose) {
      return { fired: false, trigger_value: null, reason: "no_close_event", detail: {} };
    }

    const closedAt = new Date(lastClose.occurred_at).getTime();
    const now = new Date(req.recorded_at).getTime();
    const minsSinceClosed = (now - closedAt) / (1000 * 60);
    const durationMin = config.duration_minutes ?? 30;

    if (minsSinceClosed < durationMin) {
      return { fired: false, trigger_value: req.temperature, reason: "not_enough_time_since_close", detail: { mins_since_closed: minsSinceClosed } };
    }

    // Check if temp is above safe range (>41°F for fridge)
    const fired = req.temperature > 41;
    return {
      fired,
      trigger_value: req.temperature,
      reason: fired ? "post_close_no_recovery" : "temp_recovered",
      detail: { mins_since_closed: minsSinceClosed, temperature: req.temperature },
    };
  }

  // gasket_leak_infer, tvoc_temp_refrigerant — defer complex correlations
  return { fired: false, trigger_value: null, reason: "t3_not_implemented", detail: { slug } };
}

// ─── T4 Evaluator: Site-wide patterns ────────────────────────────────────────

async function evaluateT4(
  supabase: ReturnType<typeof createClient>,
  alarm: AlarmDef,
  config: EffectiveConfig,
  req: EvalRequest
): Promise<{ fired: boolean; trigger_value: number | null; reason: string; detail: Record<string, unknown> }> {
  if (config.severity === "normal" || !req.site_id) {
    return { fired: false, trigger_value: null, reason: req.site_id ? "normal_severity_skip" : "no_site", detail: {} };
  }

  const slug = alarm.slug;

  if (slug === "site_wide_temp_rise") {
    // Check if 3+ units at this site are all warming
    const { data: siteUnits } = await supabase
      .from("units")
      .select("id, last_temp_reading, last_reading_at")
      .eq("site_id", req.site_id)
      .not("last_temp_reading", "is", null);

    if (!siteUnits || siteUnits.length < 3) {
      return { fired: false, trigger_value: null, reason: "fewer_than_3_units", detail: { unit_count: siteUnits?.length ?? 0 } };
    }

    // For each unit, check if temp is above 41°F (simple heuristic)
    const warmingUnits = siteUnits.filter(
      (u: { last_temp_reading: number }) => u.last_temp_reading > 41
    );

    const fired = warmingUnits.length >= 3;
    return {
      fired,
      trigger_value: warmingUnits.length,
      reason: fired ? "site_wide_warming" : "not_enough_warming",
      detail: { total_units: siteUnits.length, warming_count: warmingUnits.length },
    };
  }

  if (slug === "isolated_unit_failure") {
    if (req.temperature === undefined) {
      return { fired: false, trigger_value: null, reason: "no_temp", detail: {} };
    }
    // This unit is warming, but check if other site units are stable
    if (req.temperature <= 41) {
      return { fired: false, trigger_value: req.temperature, reason: "this_unit_normal", detail: {} };
    }

    const { data: otherUnits } = await supabase
      .from("units")
      .select("id, last_temp_reading")
      .eq("site_id", req.site_id)
      .neq("id", req.unit_id)
      .not("last_temp_reading", "is", null);

    if (!otherUnits || otherUnits.length < 2) {
      return { fired: false, trigger_value: null, reason: "not_enough_other_units", detail: {} };
    }

    const stableOthers = otherUnits.filter(
      (u: { last_temp_reading: number }) => u.last_temp_reading <= 41
    );

    const fired = stableOthers.length >= 2;
    return {
      fired,
      trigger_value: req.temperature,
      reason: fired ? "isolated_failure" : "other_units_also_warming",
      detail: { this_temp: req.temperature, stable_others: stableOthers.length },
    };
  }

  return { fired: false, trigger_value: null, reason: "t4_not_implemented", detail: { slug } };
}

// ─── Main Evaluation Engine ──────────────────────────────────────────────────

async function evaluateAlarm(
  supabase: ReturnType<typeof createClient>,
  alarm: AlarmDef,
  config: EffectiveConfig,
  req: EvalRequest
): Promise<EvalResult> {
  const start = Date.now();

  if (!config.enabled) {
    return {
      alarm,
      config,
      fired: false,
      trigger_value: null,
      reason: "disabled",
      cooldown_active: false,
      dedup_hit: false,
      eval_detail: {},
      duration_ms: Date.now() - start,
    };
  }

  let result: { fired: boolean; trigger_value: number | null; reason: string; detail: Record<string, unknown> };

  switch (alarm.detection_tier) {
    case "T1":
      result = evaluateT1(alarm, config, req);
      break;
    case "T2":
      result = await evaluateT2(supabase, alarm, config, req);
      break;
    case "T3":
      result = await evaluateT3(supabase, alarm, config, req);
      break;
    case "T4":
      result = await evaluateT4(supabase, alarm, config, req);
      break;
    case "T5":
      // T5 uses same threshold logic as T1 for environmental sensors
      result = evaluateT1(alarm, config, req);
      break;
    default:
      result = { fired: false, trigger_value: null, reason: "unknown_tier", detail: {} };
  }

  // Door duration check for T1 door alarms
  if (result.fired && result.detail.duration_check && alarm.duration_minutes) {
    const durationMin = config.duration_minutes ?? alarm.duration_minutes;
    // Look up the last door open event
    const { data: doorEvents } = await supabase
      .from("door_events")
      .select("state, occurred_at")
      .eq("unit_id", req.unit_id)
      .eq("state", "open")
      .order("occurred_at", { ascending: false })
      .limit(1);

    if (doorEvents && doorEvents.length > 0) {
      const openedAt = new Date(doorEvents[0].occurred_at).getTime();
      const now = new Date(req.recorded_at).getTime();
      const minsSinceOpen = (now - openedAt) / (1000 * 60);

      if (minsSinceOpen < durationMin) {
        result.fired = false;
        result.reason = "door_open_duration_not_met";
        result.detail = { ...result.detail, mins_open: minsSinceOpen, required: durationMin };
      } else {
        result.trigger_value = Math.round(minsSinceOpen);
        result.reason = "door_open_duration_exceeded";
        result.detail = { ...result.detail, mins_open: minsSinceOpen, required: durationMin };
      }
    } else {
      result.fired = false;
      result.reason = "no_door_open_event";
    }
  }

  // Cooldown check
  let cooldownActive = false;
  let dedupHit = false;

  if (result.fired) {
    const cooldownMinutes = config.cooldown_minutes ?? alarm.cooldown_minutes ?? 30;

    // Check for existing active alarm event within cooldown window
    const { data: existingEvents } = await supabase
      .from("alarm_events")
      .select("id, state, triggered_at, cooldown_until")
      .eq("alarm_definition_id", alarm.id)
      .eq("unit_id", req.unit_id)
      .in("state", ["active", "acknowledged"])
      .order("triggered_at", { ascending: false })
      .limit(1);

    if (existingEvents && existingEvents.length > 0) {
      const existing = existingEvents[0];
      const triggeredAt = new Date(existing.triggered_at).getTime();
      const now = new Date(req.recorded_at).getTime();
      const cooldownUntil = existing.cooldown_until
        ? new Date(existing.cooldown_until).getTime()
        : triggeredAt + cooldownMinutes * 60 * 1000;

      if (now < cooldownUntil) {
        cooldownActive = true;
        result.fired = false;
        result.reason = "cooldown_active";
      }

      // Dedup: if same alarm is still active, don't re-fire
      if (existing.state === "active") {
        dedupHit = true;
        result.fired = false;
        result.reason = "dedup_active_exists";
      }
    }
  }

  return {
    alarm,
    config,
    fired: result.fired,
    trigger_value: result.trigger_value,
    reason: result.reason,
    cooldown_active: cooldownActive,
    dedup_hit: dedupHit,
    eval_detail: result.detail,
    duration_ms: Date.now() - start,
  };
}

// ─── Serve ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[EVAL-ALARMS] ${requestId} | Starting`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing env vars" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const body: EvalRequest = await req.json();
    const { unit_id, org_id, site_id, dev_eui, recorded_at } = body;

    if (!unit_id || !org_id) {
      return new Response(
        JSON.stringify({ error: "unit_id and org_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[EVAL-ALARMS] ${requestId} | unit=${unit_id} org=${org_id} temp=${body.temperature ?? "N/A"} door=${body.door_open ?? "N/A"}`);

    // ────────────────────────────────────────────────────────────
    // 1. Fetch available alarms for this unit (uses RPC)
    // ────────────────────────────────────────────────────────────
    const { data: availableAlarms, error: alarmsErr } = await supabase.rpc(
      "get_available_alarms_for_unit",
      { p_unit_id: unit_id, p_org_id: org_id, p_site_id: site_id ?? null }
    );

    if (alarmsErr) {
      console.error(`[EVAL-ALARMS] ${requestId} | RPC error:`, alarmsErr.message);
      return new Response(
        JSON.stringify({ error: "Failed to fetch alarms", detail: alarmsErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const enabledAlarms = (availableAlarms ?? []).filter(
      (a: { enabled: boolean }) => a.enabled
    );
    console.log(`[EVAL-ALARMS] ${requestId} | Available: ${availableAlarms?.length ?? 0}, Enabled: ${enabledAlarms.length}`);

    if (enabledAlarms.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, evaluated: 0, fired: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ────────────────────────────────────────────────────────────
    // 2. Fetch full definitions for all enabled alarms
    // ────────────────────────────────────────────────────────────
    const alarmIds = enabledAlarms.map((a: { alarm_id: string }) => a.alarm_id);
    const { data: fullDefs } = await supabase
      .from("alarm_definitions")
      .select("*")
      .in("id", alarmIds);

    if (!fullDefs || fullDefs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, evaluated: 0, fired: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ────────────────────────────────────────────────────────────
    // 3. Fetch effective config for each alarm (batch)
    // ────────────────────────────────────────────────────────────
    const configPromises = fullDefs.map(async (def: AlarmDef) => {
      const { data: config } = await supabase.rpc("get_effective_alarm_config", {
        p_alarm_slug: def.slug,
        p_org_id: org_id,
        p_site_id: site_id ?? null,
        p_unit_id: unit_id,
      });
      return { slug: def.slug, config: config as EffectiveConfig | null };
    });

    const configs = await Promise.all(configPromises);
    const configMap = new Map<string, EffectiveConfig>();
    for (const c of configs) {
      if (c.config) configMap.set(c.slug, c.config);
    }

    // ────────────────────────────────────────────────────────────
    // 4. Evaluate each alarm
    // ────────────────────────────────────────────────────────────
    const results: EvalResult[] = [];

    for (const def of fullDefs as AlarmDef[]) {
      const config = configMap.get(def.slug);
      if (!config) continue;

      const evalResult = await evaluateAlarm(supabase, def, config, body);
      results.push(evalResult);
    }

    const firedResults = results.filter((r) => r.fired);
    console.log(`[EVAL-ALARMS] ${requestId} | Evaluated: ${results.length}, Fired: ${firedResults.length}`);

    // ────────────────────────────────────────────────────────────
    // 5. Insert alarm_events for fired alarms + bridge to alerts
    // ────────────────────────────────────────────────────────────
    const correlationId = crypto.randomUUID();

    for (const result of firedResults) {
      const cooldownMinutes = result.config.cooldown_minutes ?? result.alarm.cooldown_minutes ?? 30;
      const cooldownUntil = new Date(
        new Date(recorded_at).getTime() + cooldownMinutes * 60 * 1000
      ).toISOString();

      // Insert alarm_event
      const { data: alarmEvent, error: eventErr } = await supabase
        .from("alarm_events")
        .insert({
          alarm_definition_id: result.alarm.id,
          org_id,
          site_id: site_id ?? null,
          unit_id,
          dev_eui: dev_eui ?? null,
          state: "active",
          severity_at_trigger: result.config.severity ?? result.alarm.severity,
          trigger_value: result.trigger_value,
          trigger_field: result.alarm.eval_field,
          trigger_payload: {
            temperature: body.temperature,
            humidity: body.humidity,
            battery_level: body.battery_level,
            door_open: body.door_open,
            signal_strength: body.signal_strength,
          },
          cooldown_until: cooldownUntil,
          correlation_id: firedResults.length > 1 ? correlationId : null,
          correlation_type: firedResults.length > 1 ? "concurrent_eval" : null,
        })
        .select("id")
        .single();

      if (eventErr) {
        console.error(`[EVAL-ALARMS] ${requestId} | Event insert error for ${result.alarm.slug}:`, eventErr.message);
        continue;
      }

      console.log(`[EVAL-ALARMS] ${requestId} | FIRED: ${result.alarm.slug} (${result.config.severity}) event=${alarmEvent?.id}`);

      // ── Bridge: Insert into alerts table for process-escalations ──
      const alertType = result.alarm.category === "temperature" ? "alarm_active" :
                        result.alarm.category === "door" ? "door_open" :
                        result.alarm.category === "sensor_health" ? "monitoring_interrupted" :
                        result.alarm.category === "environmental" ? "alarm_active" :
                        "alarm_active";

      const { error: alertErr } = await supabase.from("alerts").insert({
        title: result.alarm.display_name,
        message: result.alarm.corrective_action_text,
        alert_type: alertType,
        severity: result.config.severity === "emergency" ? "critical" : result.config.severity,
        status: "active",
        temp_reading: body.temperature ?? null,
        temp_limit: result.config.threshold_max ?? result.config.threshold_min ?? null,
        unit_id,
        triggered_at: recorded_at,
        first_active_at: recorded_at,
        metadata: {
          alarm_event_id: alarmEvent?.id,
          alarm_slug: result.alarm.slug,
          alarm_definition_id: result.alarm.id,
          detection_tier: result.alarm.detection_tier,
          eval_detail: result.eval_detail,
          low_limit: result.config.threshold_min,
          high_limit: result.config.threshold_max,
        },
      });

      if (alertErr) {
        console.error(`[EVAL-ALARMS] ${requestId} | Alert bridge error for ${result.alarm.slug}:`, alertErr.message);
      }
    }

    // ────────────────────────────────────────────────────────────
    // 6. Log all evaluations to alarm_evaluation_log
    // ────────────────────────────────────────────────────────────
    const logRows = results.map((r) => ({
      org_id,
      site_id: site_id ?? null,
      unit_id,
      dev_eui: dev_eui ?? null,
      alarm_slug: r.alarm.slug,
      detection_tier: r.alarm.detection_tier,
      fired: r.fired,
      trigger_value: r.trigger_value,
      threshold_min: r.config.threshold_min,
      threshold_max: r.config.threshold_max,
      eval_duration_ms: r.duration_ms,
      eval_detail: { reason: r.reason, ...r.eval_detail },
      cooldown_active: r.cooldown_active,
      dedup_hit: r.dedup_hit,
    }));

    // Batch insert in chunks of 50
    for (let i = 0; i < logRows.length; i += 50) {
      const chunk = logRows.slice(i, i + 50);
      const { error: logErr } = await supabase
        .from("alarm_evaluation_log")
        .insert(chunk);
      if (logErr) {
        console.error(`[EVAL-ALARMS] ${requestId} | Log insert error:`, logErr.message);
      }
    }

    // ────────────────────────────────────────────────────────────
    // 7. Auto-resolve: check if any active alarm_events should resolve
    // ────────────────────────────────────────────────────────────
    // Get all currently active alarm events for this unit
    const { data: activeEvents } = await supabase
      .from("alarm_events")
      .select("id, alarm_definition_id")
      .eq("unit_id", unit_id)
      .eq("state", "active");

    if (activeEvents && activeEvents.length > 0) {
      const firedDefIds = new Set(firedResults.map((r) => r.alarm.id));
      // Also get IDs of alarms that evaluated but didn't fire (potential auto-resolve)
      const notFiredResults = results.filter(
        (r) => !r.fired && r.reason !== "disabled" && r.reason !== "cooldown_active" && r.reason !== "dedup_active_exists"
      );
      const notFiredDefIds = new Set(notFiredResults.map((r) => r.alarm.id));

      for (const event of activeEvents) {
        // If this alarm was evaluated and didn't fire, auto-resolve it
        if (notFiredDefIds.has(event.alarm_definition_id) && !firedDefIds.has(event.alarm_definition_id)) {
          await supabase
            .from("alarm_events")
            .update({
              state: "auto_resolved",
              resolved_at: recorded_at,
              resolved_by: "system",
              resolution_notes: "Auto-resolved: condition no longer met",
            })
            .eq("id", event.id);

          console.log(`[EVAL-ALARMS] ${requestId} | AUTO-RESOLVED event=${event.id}`);

          // Also resolve corresponding alert
          await supabase
            .from("alerts")
            .update({ status: "resolved", resolved_at: recorded_at })
            .eq("status", "active")
            .eq("unit_id", unit_id)
            .contains("metadata", { alarm_event_id: event.id });
        }
      }
    }

    const summary = {
      ok: true,
      request_id: requestId,
      evaluated: results.length,
      fired: firedResults.length,
      fired_slugs: firedResults.map((r) => r.alarm.slug),
    };

    console.log(`[EVAL-ALARMS] ${requestId} | Done. ${JSON.stringify(summary)}`);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[EVAL-ALARMS] ${requestId} | Error:`, msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
