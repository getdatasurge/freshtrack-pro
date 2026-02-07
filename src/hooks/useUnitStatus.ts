import { useMemo } from "react";
import {
  AlertRules,
  DEFAULT_ALERT_RULES,
  computeMissedCheckins,
  computeOfflineSeverity,
} from "./useAlertRules";
import {
  calculateMissedCheckins,
  formatMissedCheckinsMessage,
  getMissedCheckinDuration
} from "@/lib/missedCheckins";

export interface UnitStatusInfo {
  id: string;
  name: string;
  unit_type: string;
  status: string;
  temp_limit_high: number;
  temp_limit_low: number | null;
  manual_log_cadence: number;
  last_manual_log_at: string | null;
  last_reading_at: string | null;
  last_temp_reading: number | null;
  area: {
    name: string;
    site: { name: string };
  };
  // Sensor reliability fields
  sensor_reliable?: boolean;
  manual_logging_enabled?: boolean;
  consecutive_checkins?: number;
  // Missed check-in tracking fields
  // IMPORTANT: checkin_interval_minutes should be kept in sync with the sensor's
  // configured uplink_interval_s (converted to minutes). Backend processes
  // (TTN webhook, downlink handlers) are responsible for updating this field
  // when the sensor's uplink interval changes.
  last_checkin_at?: string | null;
  checkin_interval_minutes?: number; // Should match sensor's uplink interval
}

export type OfflineSeverity = "none" | "warning" | "critical";

export interface ComputedUnitStatus {
  // Core statuses
  sensorOnline: boolean;
  manualRequired: boolean;
  tempInRange: boolean;
  actionRequired: boolean;
  
  // Missed check-in tracking
  missedCheckins: number;
  offlineSeverity: OfflineSeverity;
  
  // Manual log timing (based on last_reading_at, not offline time)
  manualLogDueAt: Date | null;
  isManualLogDue: boolean;
  
  // Computed values (legacy, kept for compatibility)
  minutesSinceManualLog: number | null;
  manualIntervalMinutes: number;
  manualOverdueMinutes: number;
  minutesSinceReading: number | null;
  offlineThresholdMs: number;
  
  // Status labels
  statusLabel: string;
  statusColor: string;
  statusBgColor: string;
}

// Default check-in interval (5 minutes) - used as fallback only
// IMPORTANT: In production, checkin_interval_minutes should always be populated
// from the sensor's configured uplink_interval_s
const DEFAULT_CHECKIN_INTERVAL_MINUTES = 5;

export function computeUnitStatus(unit: UnitStatusInfo, rules?: AlertRules): ComputedUnitStatus {
  const now = Date.now();
  const effectiveRules = rules || DEFAULT_ALERT_RULES;

  // Get the unit's check-in interval (per-unit setting)
  // This MUST reflect the sensor's actual configured uplink interval for accurate
  // missed check-in calculations. Backend processes sync this from sensor_config.uplink_interval_s.
  const checkinIntervalMinutes = unit.checkin_interval_minutes || DEFAULT_CHECKIN_INTERVAL_MINUTES;

  // Compute missed check-ins based on last_checkin_at (or fall back to last_reading_at)
  // Uses the interval-based calculation: floor((now - last) / interval)
  const lastCheckinAt = unit.last_checkin_at || unit.last_reading_at;
  const missedCheckins = computeMissedCheckins(lastCheckinAt, checkinIntervalMinutes);
  
  // Compute offline severity based on missed check-ins
  const offlineSeverity = computeOfflineSeverity(missedCheckins, effectiveRules);
  const sensorOnline = offlineSeverity === "none";
  
  // Legacy offline threshold calculation (kept for backward compatibility)
  const offlineThresholdMs = (
    effectiveRules.expected_reading_interval_seconds * effectiveRules.offline_trigger_multiplier * 1000 +
    effectiveRules.offline_trigger_additional_minutes * 60 * 1000
  );
  
  // Manual log interval from rules
  const manualIntervalMinutes = effectiveRules.manual_interval_minutes;
  const manualGraceMinutes = effectiveRules.manual_grace_minutes;
  
  // Time since last manual log
  let minutesSinceManualLog: number | null = null;
  if (unit.last_manual_log_at) {
    minutesSinceManualLog = Math.floor((now - new Date(unit.last_manual_log_at).getTime()) / 60000);
  }
  
  // Time since last sensor reading
  let minutesSinceReading: number | null = null;
  if (unit.last_reading_at) {
    minutesSinceReading = Math.floor((now - new Date(unit.last_reading_at).getTime()) / 60000);
  }
  
  // Manual log due time: based on last_reading_at (not offline time)
  // This is the key change: manual logging is required 4 hours after the last known temperature reading
  const manualLogDueAt = unit.last_reading_at 
    ? new Date(new Date(unit.last_reading_at).getTime() + manualIntervalMinutes * 60000)
    : null;
  
  // Check if manual log is actually due (past due time + grace period)
  const isManualLogDue = manualLogDueAt 
    ? now > manualLogDueAt.getTime() + (manualGraceMinutes * 60000)
    : true; // If no last reading, consider it due
  
  // Check if sensor is reliable (paired + 2 consecutive check-ins)
  const isSensorReliable = unit.sensor_reliable === true;
  const isManualLoggingEnabled = unit.manual_logging_enabled !== false;
  
  // Manual required: ONLY if
  // 1. manual_logging_enabled is true (default true)
  // 2. missed check-ins >= threshold (from org rules)
  // 3. manual log is actually due (4 hours since last reading)
  const manualRequired = 
    isManualLoggingEnabled &&
    missedCheckins >= effectiveRules.manual_log_missed_checkins_threshold &&
    isManualLogDue;
  
  // How many minutes overdue (beyond the required interval)
  const manualOverdueMinutes = minutesSinceManualLog !== null 
    ? Math.max(0, minutesSinceManualLog - manualIntervalMinutes)
    : manualIntervalMinutes; // If never logged, consider fully overdue
  
  // Temperature in range
  const tempInRange = unit.last_temp_reading !== null &&
    unit.last_temp_reading <= unit.temp_limit_high &&
    (unit.temp_limit_low === null || unit.last_temp_reading >= unit.temp_limit_low);
  
  // Action required: any actionable condition
  const actionRequired = 
    !sensorOnline ||
    manualRequired ||
    unit.status === "alarm_active" ||
    unit.status === "excursion" ||
    unit.status === "manual_required" ||
    unit.status === "monitoring_interrupted" ||
    unit.status === "offline";
  
  // Status display - computed offlineSeverity takes precedence over stale DB status
  // This ensures fresh sensor heartbeats are reflected immediately, even before DB updates
  let statusLabel = "OK";
  let statusColor = "text-safe";
  let statusBgColor = "bg-safe/10";
  
  // 1. Check alarm/excursion FIRST (temperature-based alerts, not connectivity-based)
  if (unit.status === "alarm_active") {
    statusLabel = "ALARM";
    statusColor = "text-alarm";
    statusBgColor = "bg-alarm/10";
  } else if (unit.status === "excursion") {
    statusLabel = "Excursion";
    statusColor = "text-excursion";
    statusBgColor = "bg-excursion/10";
  // 2. Check computed offlineSeverity (NOT unit.status for offline!)
  // This is the key fix: use computed status, not stale DB value
  } else if (offlineSeverity === "critical") {
    statusLabel = "Offline";
    statusColor = "text-alarm";
    statusBgColor = "bg-alarm/10";
  } else if (offlineSeverity === "warning") {
    statusLabel = "Offline";
    statusColor = "text-warning";
    statusBgColor = "bg-warning/10";
  // 3. Manual required (only when online but needs action)
  } else if (manualRequired) {
    statusLabel = "Log Required";
    statusColor = "text-warning";
    statusBgColor = "bg-warning/10";
  // 4. Restoring state
  } else if (unit.status === "restoring") {
    statusLabel = "Restoring";
    statusColor = "text-accent";
    statusBgColor = "bg-accent/10";
  // 5. Default: Online/OK (offlineSeverity is "none")
  } else {
    statusLabel = "OK";
    statusColor = "text-safe";
    statusBgColor = "bg-safe/10";
  }
  
  // Dev assertion: verify label matches computed status
  if (process.env.NODE_ENV === 'development') {
    if (offlineSeverity === "none" && statusLabel === "Offline") {
      console.error('[STATUS BUG] offlineSeverity is "none" but statusLabel is "Offline"', {
        offlineSeverity, statusLabel, unitStatus: unit.status, missedCheckins, sensorOnline
      });
    }
  }
  
  return {
    sensorOnline,
    manualRequired,
    tempInRange,
    actionRequired,
    missedCheckins,
    offlineSeverity,
    manualLogDueAt,
    isManualLogDue,
    minutesSinceManualLog,
    manualIntervalMinutes,
    manualOverdueMinutes,
    minutesSinceReading,
    offlineThresholdMs,
    statusLabel,
    statusColor,
    statusBgColor,
  };
}

export function useUnitStatus(unit: UnitStatusInfo | null, rules?: AlertRules): ComputedUnitStatus | null {
  return useMemo(() => {
    if (!unit) return null;
    return computeUnitStatus(unit, rules);
  }, [unit, rules]);
}

export function useUnitsStatus(units: UnitStatusInfo[], rulesMap?: Map<string, AlertRules>): Array<UnitStatusInfo & { computed: ComputedUnitStatus }> {
  return useMemo(() => {
    return units.map(unit => ({
      ...unit,
      computed: computeUnitStatus(unit, rulesMap?.get(unit.id)),
    }));
  }, [units, rulesMap]);
}
