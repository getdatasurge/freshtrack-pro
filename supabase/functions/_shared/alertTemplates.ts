/**
 * Shared Alert Notification Templates — Server-side (Deno Edge Functions)
 *
 * Mirrored from src/lib/alertTemplates.ts — keep in sync.
 * Used by process-escalations, process-escalation-steps, acknowledge-alert.
 */

// ─── Alert Type Labels ───────────────────────────────────────────────────────

export const ALERT_TYPE_LABELS: Record<string, string> = {
  alarm_active: "Temperature Alarm",
  monitoring_interrupted: "Monitoring Interrupted",
  missed_manual_entry: "Missed Manual Entry",
  low_battery: "Low Battery",
  sensor_fault: "Sensor Fault",
  door_open: "Door Left Open",
  calibration_due: "Calibration Due",
  temp_excursion: "Temperature Excursion",
  suspected_cooling_failure: "Suspected Cooling Failure",
};

export function getAlertTypeLabel(alertType: string): string {
  return ALERT_TYPE_LABELS[alertType] || alertType;
}

// ─── Severity Configuration ──────────────────────────────────────────────────

export const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  warning: "⚠️",
  info: "🔔",
};

export const SEVERITY_EMAIL_COLORS: Record<string, string> = {
  critical: "#dc2626",
  warning: "#f59e0b",
  info: "#3b82f6",
};

// ─── Email Subject Templates ─────────────────────────────────────────────────

export function buildEmailSubject(alertType: string, severity: string, unitName: string): string {
  const alertLabel = getAlertTypeLabel(alertType);
  return `[${severity.toUpperCase()}] ${alertLabel}: ${unitName}`;
}

export function buildEscalationEmailSubject(alertType: string, stepNumber: number, unitName: string): string {
  const alertLabel = getAlertTypeLabel(alertType);
  return `[ESCALATION Step ${stepNumber}] ${alertLabel}: ${unitName}`;
}

// ─── In-App Notification Templates ───────────────────────────────────────────

export function buildInAppTitle(
  alertType: string,
  severity: string,
  unitName: string
): string {
  const emoji = SEVERITY_EMOJI[severity] || "🔔";
  const alertLabel = getAlertTypeLabel(alertType);
  return `${emoji} ${alertLabel}: ${unitName}`;
}

export function buildInAppBody(
  message: string | null,
  title: string | null,
  escalationStep?: number
): string {
  if (escalationStep && escalationStep > 0) {
    return `Escalation Step ${escalationStep} — ${message || title || "Requires attention"}`;
  }
  return message || title || "Alert triggered — check unit status";
}
