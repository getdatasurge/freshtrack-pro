import { useMemo } from "react";
import { computeUnitStatus, UnitStatusInfo } from "./useUnitStatus";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertType = "MANUAL_REQUIRED" | "OFFLINE" | "EXCURSION" | "ALARM_ACTIVE";

export interface ComputedAlert {
  id: string; // unit_id + alert_type for dedup
  unit_id: string;
  unit_name: string;
  site_name: string;
  area_name: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  created_at: string;
}

export interface UnitAlertsSummary {
  alerts: ComputedAlert[];
  criticalCount: number;
  warningCount: number;
  totalCount: number;
  unitsOk: number;
  unitsWithAlerts: number;
}

/**
 * Computes alerts from unit status - single source of truth for Dashboard + Alerts page
 */
export function computeUnitAlerts(units: UnitStatusInfo[]): UnitAlertsSummary {
  const alerts: ComputedAlert[] = [];
  let unitsOk = 0;
  const unitIdsWithAlerts = new Set<string>();

  for (const unit of units) {
    const computed = computeUnitStatus(unit);
    let hasAlert = false;

    // MANUAL_REQUIRED - CRITICAL
    if (computed.manualRequired) {
      alerts.push({
        id: `${unit.id}-MANUAL_REQUIRED`,
        unit_id: unit.id,
        unit_name: unit.name,
        site_name: unit.area.site.name,
        area_name: unit.area.name,
        type: "MANUAL_REQUIRED",
        severity: "critical",
        title: "Manual Logging Required",
        message: computed.minutesSinceManualLog === null
          ? "No manual log has ever been recorded"
          : `Manual log is ${Math.floor(computed.manualOverdueMinutes / 60)}h ${computed.manualOverdueMinutes % 60}m overdue`,
        created_at: new Date().toISOString(),
      });
      hasAlert = true;
    }

    // OFFLINE - WARNING (independent of manual required)
    if (!computed.sensorOnline) {
      alerts.push({
        id: `${unit.id}-OFFLINE`,
        unit_id: unit.id,
        unit_name: unit.name,
        site_name: unit.area.site.name,
        area_name: unit.area.name,
        type: "OFFLINE",
        severity: "warning",
        title: "Sensor Offline",
        message: computed.minutesSinceReading === null
          ? "No sensor data has ever been received"
          : `Last reading was ${computed.minutesSinceReading} minutes ago`,
        created_at: new Date().toISOString(),
      });
      hasAlert = true;
    }

    // ALARM_ACTIVE - CRITICAL
    if (unit.status === "alarm_active") {
      alerts.push({
        id: `${unit.id}-ALARM_ACTIVE`,
        unit_id: unit.id,
        unit_name: unit.name,
        site_name: unit.area.site.name,
        area_name: unit.area.name,
        type: "ALARM_ACTIVE",
        severity: "critical",
        title: "Temperature Alarm",
        message: `Temperature at ${unit.last_temp_reading?.toFixed(1) || "--"}°F exceeds limit of ${unit.temp_limit_high}°F`,
        created_at: new Date().toISOString(),
      });
      hasAlert = true;
    }

    // EXCURSION - WARNING
    if (unit.status === "excursion") {
      alerts.push({
        id: `${unit.id}-EXCURSION`,
        unit_id: unit.id,
        unit_name: unit.name,
        site_name: unit.area.site.name,
        area_name: unit.area.name,
        type: "EXCURSION",
        severity: "warning",
        title: "Temperature Excursion",
        message: `Temperature at ${unit.last_temp_reading?.toFixed(1) || "--"}°F is out of range`,
        created_at: new Date().toISOString(),
      });
      hasAlert = true;
    }

    if (hasAlert) {
      unitIdsWithAlerts.add(unit.id);
    } else {
      unitsOk++;
    }
  }

  // Sort: critical first, then warning
  alerts.sort((a, b) => {
    if (a.severity === "critical" && b.severity !== "critical") return -1;
    if (a.severity !== "critical" && b.severity === "critical") return 1;
    return 0;
  });

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return {
    alerts,
    criticalCount,
    warningCount,
    totalCount: alerts.length,
    unitsOk,
    unitsWithAlerts: unitIdsWithAlerts.size,
  };
}

/**
 * Hook to compute alerts from units - use in components
 */
export function useUnitAlerts(units: UnitStatusInfo[]): UnitAlertsSummary {
  return useMemo(() => computeUnitAlerts(units), [units]);
}
