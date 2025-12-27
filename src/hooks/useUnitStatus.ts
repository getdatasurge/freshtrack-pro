import { useMemo } from "react";

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
  
  // Status labels
  statusLabel: string;
  statusColor: string;
  statusBgColor: string;
}

// Threshold for considering a sensor offline (10 minutes)
const SENSOR_OFFLINE_THRESHOLD_MS = 10 * 60 * 1000;

export function computeUnitStatus(unit: UnitStatusInfo): ComputedUnitStatus {
  const now = Date.now();
  
  // Manual log cadence in minutes
  const manualIntervalMinutes = unit.manual_log_cadence / 60;
  
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
  
  // Sensor online status
  const sensorOnline = unit.last_reading_at !== null && 
    (now - new Date(unit.last_reading_at).getTime()) < SENSOR_OFFLINE_THRESHOLD_MS;
  
  // Manual required: no log ever OR log older than interval
  const manualRequired = 
    minutesSinceManualLog === null || 
    minutesSinceManualLog >= manualIntervalMinutes;
  
  // How many minutes overdue
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
    statusLabel,
    statusColor,
    statusBgColor,
  };
}

export function useUnitStatus(unit: UnitStatusInfo | null): ComputedUnitStatus | null {
  return useMemo(() => {
    if (!unit) return null;
    return computeUnitStatus(unit);
  }, [unit]);
}

export function useUnitsStatus(units: UnitStatusInfo[]): Array<UnitStatusInfo & { computed: ComputedUnitStatus }> {
  return useMemo(() => {
    return units.map(unit => ({
      ...unit,
      computed: computeUnitStatus(unit),
    }));
  }, [units]);
}
