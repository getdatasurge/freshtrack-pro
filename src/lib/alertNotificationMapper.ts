import { formatDistanceToNow } from "date-fns";
import { ALERT_TYPE_LABELS, formatAlertDetail as sharedFormatDetail } from "./alertTemplates";

// Re-export from shared templates for backwards compatibility
export const alertTypeLabels = ALERT_TYPE_LABELS;

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
 * Format alert detail based on alert type and available data.
 * Delegates to shared template function.
 */
function formatAlertDetail(alert: AlertWithContext): string {
  return sharedFormatDetail({
    alertType: alert.alert_type,
    tempReading: alert.temp_reading,
    tempLimit: alert.temp_limit,
    message: alert.message,
    metadata: alert.metadata,
  });
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
