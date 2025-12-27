import { useMemo } from "react";
import { AlertRules, DEFAULT_ALERT_RULES, computeOfflineTriggerMs, computeManualTriggerMinutes } from "./useAlertRules";

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
}

export interface ComputedUnitStatus {
  // Core statuses
  sensorOnline: boolean;
  manualRequired: boolean;
  tempInRange: boolean;
  actionRequired: boolean;
  
  // Computed values
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

// Default threshold for backward compatibility (10 minutes)
const DEFAULT_SENSOR_OFFLINE_THRESHOLD_MS = 10 * 60 * 1000;

export function computeUnitStatus(unit: UnitStatusInfo, rules?: AlertRules): ComputedUnitStatus {
  const now = Date.now();
  const effectiveRules = rules || DEFAULT_ALERT_RULES;
  
  // Calculate offline threshold from rules
  const offlineThresholdMs = computeOfflineTriggerMs(effectiveRules);
  
  // Manual log interval from rules (with grace period)
  const manualTriggerMinutes = computeManualTriggerMinutes(effectiveRules);
  const manualIntervalMinutes = effectiveRules.manual_interval_minutes;
  
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
  
  // Sensor online status using configurable threshold
  const sensorOnline = unit.last_reading_at !== null && 
    (now - new Date(unit.last_reading_at).getTime()) < offlineThresholdMs;
  
  // Manual required: no log ever OR log older than interval + grace
  const manualRequired = 
    minutesSinceManualLog === null || 
    minutesSinceManualLog >= manualTriggerMinutes;
  
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
  
  // Status display
  let statusLabel = "OK";
  let statusColor = "text-safe";
  let statusBgColor = "bg-safe/10";
  
  if (unit.status === "alarm_active") {
    statusLabel = "ALARM";
    statusColor = "text-alarm";
    statusBgColor = "bg-alarm/10";
  } else if (unit.status === "excursion") {
    statusLabel = "Excursion";
    statusColor = "text-excursion";
    statusBgColor = "bg-excursion/10";
  } else if (!sensorOnline || unit.status === "offline" || unit.status === "monitoring_interrupted") {
    statusLabel = "Offline";
    statusColor = "text-warning";
    statusBgColor = "bg-warning/10";
  } else if (manualRequired || unit.status === "manual_required") {
    statusLabel = "Log Required";
    statusColor = "text-warning";
    statusBgColor = "bg-warning/10";
  } else if (unit.status === "restoring") {
    statusLabel = "Restoring";
    statusColor = "text-accent";
    statusBgColor = "bg-accent/10";
  } else if (unit.status === "ok") {
    statusLabel = "OK";
    statusColor = "text-safe";
    statusBgColor = "bg-safe/10";
  }
  
  return {
    sensorOnline,
    manualRequired,
    tempInRange,
    actionRequired,
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
