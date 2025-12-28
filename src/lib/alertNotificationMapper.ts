import { formatDistanceToNow } from "date-fns";

// Map alert_type to human-readable titles
export const alertTypeLabels: Record<string, string> = {
  temp_excursion: "Temperature Excursion",
  alarm_active: "Temperature Alarm",
  monitoring_interrupted: "Sensor Offline",
  missed_manual_entry: "Manual Logging Required",
  low_battery: "Low Battery",
  door_open: "Door Left Open",
  suspected_cooling_failure: "Suspected Cooling Failure",
  calibration_due: "Calibration Due",
  sensor_fault: "Sensor Fault",
};

// Map severity to styling
export const severityConfig = {
  critical: {
    bgColor: "bg-alarm/10",
    textColor: "text-alarm",
    borderColor: "border-alarm/30",
    iconBg: "bg-alarm/20",
  },
  warning: {
    bgColor: "bg-warning/10",
    textColor: "text-warning",
    borderColor: "border-warning/30",
    iconBg: "bg-warning/20",
  },
  info: {
    bgColor: "bg-accent/10",
    textColor: "text-accent",
    borderColor: "border-accent/30",
    iconBg: "bg-accent/20",
  },
};

export interface AlertNotification {
  id: string;
  title: string;
  context: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  timestamp: string;
  relativeTime: string;
  status: string;
  unitId: string;
  alertType: string;
}

export interface AlertWithContext {
  id: string;
  title: string;
  message: string | null;
  alert_type: string;
  severity: "critical" | "warning" | "info";
  status: string;
  temp_reading: number | null;
  temp_limit: number | null;
  triggered_at: string;
  metadata: Record<string, any> | null;
  unit_id: string;
  unit?: {
    id: string;
    name: string;
    area?: {
      id: string;
      name: string;
      site?: {
        id: string;
        name: string;
      };
    };
  };
}

/**
 * Format alert detail based on alert type and available data
 */
function formatAlertDetail(alert: AlertWithContext): string {
  const { alert_type, temp_reading, temp_limit, message, metadata } = alert;

  // Temperature-related alerts
  if ((alert_type === "temp_excursion" || alert_type === "alarm_active") && 
      temp_reading !== null && temp_limit !== null) {
    const direction = temp_reading > temp_limit ? ">" : "<";
    return `Current ${temp_reading.toFixed(1)}°F ${direction} Limit ${temp_limit.toFixed(1)}°F`;
  }

  // Offline/monitoring interrupted - use metadata if available
  if (alert_type === "monitoring_interrupted") {
    const missedCheckins = metadata?.missed_checkins;
    if (missedCheckins) {
      return `Missed ${missedCheckins} check-in${missedCheckins > 1 ? "s" : ""}`;
    }
    return "No sensor data received";
  }

  // Manual logging required
  if (alert_type === "missed_manual_entry") {
    return "Manual temperature log overdue";
  }

  // Low battery
  if (alert_type === "low_battery") {
    const level = metadata?.battery_level;
    if (level !== undefined) {
      return `Battery at ${level}%`;
    }
    return "Battery level low";
  }

  // Door open
  if (alert_type === "door_open") {
    const duration = metadata?.open_duration_minutes;
    if (duration) {
      return `Door open for ${duration} minutes`;
    }
    return "Door has been left open";
  }

  // Cooling failure
  if (alert_type === "suspected_cooling_failure") {
    return "Temperature rising despite door closed";
  }

  // Fallback to message or generic
  return message || "Alert triggered";
}

/**
 * Build context string from site/area/unit names
 */
function buildContext(alert: AlertWithContext): string {
  const unit = alert.unit;
  if (!unit) return "Unknown location";

  const parts: string[] = [];
  
  if (unit.area?.site?.name) {
    parts.push(unit.area.site.name);
  }
  if (unit.area?.name) {
    parts.push(unit.area.name);
  }
  if (unit.name) {
    parts.push(unit.name);
  }

  return parts.join(" · ") || "Unknown location";
}

/**
 * Get relative time string from timestamp
 */
export function getRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "Unknown time";
  }
}

/**
 * Map an alert to notification display format
 */
export function mapAlertToNotification(alert: AlertWithContext): AlertNotification {
  return {
    id: alert.id,
    title: alertTypeLabels[alert.alert_type] || alert.title || "Alert",
    context: buildContext(alert),
    detail: formatAlertDetail(alert),
    severity: alert.severity || "warning",
    timestamp: alert.triggered_at,
    relativeTime: getRelativeTime(alert.triggered_at),
    status: alert.status,
    unitId: alert.unit_id,
    alertType: alert.alert_type,
  };
}
