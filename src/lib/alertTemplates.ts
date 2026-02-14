/**
 * Shared Alert Notification Templates — SINGLE SOURCE OF TRUTH (Frontend)
 *
 * All alert labels, SMS templates, email subjects, and in-app notification
 * formatting should reference these constants. Edge functions have a mirrored
 * copy at supabase/functions/_shared/alertTemplates.ts — keep in sync.
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

// ─── SMS Templates ───────────────────────────────────────────────────────────

export interface SmsTemplateContext {
  unitName: string;
  siteName: string;
  alertType: string;
  severity: string;
  tempReading?: string | null; // Pre-formatted with unit symbol
  tempLimit?: string | null;
  tempRange?: string | null; // e.g. "32°F-40°F"
  batteryLevel?: number | null;
  doorDurationMinutes?: number | null;
  timestamp?: string;
}

/**
 * Build an SMS message for an initial alert notification.
 * Messages target ~160 chars for single-segment SMS delivery.
 */
export function buildSmsTemplate(ctx: SmsTemplateContext): string {
  const { unitName, alertType } = ctx;

  switch (alertType) {
    case "alarm_active":
    case "temp_excursion": {
      const temp = ctx.tempReading || "unknown";
      const range = ctx.tempRange ? `outside safe range ${ctx.tempRange}` : `past limit ${ctx.tempLimit || "?"}`;
      return `🚨 FreshTrack Alert: ${unitName} temp is ${temp} - ${range}. Check immediately.`;
    }

    case "monitoring_interrupted":
      return `⚠️ FreshTrack Alert: ${unitName} sensor has gone offline${ctx.timestamp ? ` as of ${ctx.timestamp}` : ""}. Please verify equipment status.`;

    case "low_battery": {
      const battery = ctx.batteryLevel ?? "low";
      return `🔔 FreshTrack Notice: ${unitName} sensor battery low (${battery}%). Replace soon.`;
    }

    case "door_open": {
      const duration = ctx.doorDurationMinutes || "extended";
      return `⚠️ FreshTrack Alert: ${unitName} door open for ${duration} min. Check equipment.`;
    }

    case "missed_manual_entry":
      return `📝 FreshTrack Notice: ${unitName} is due for a manual temperature log. Please record a reading.`;

    case "sensor_fault":
      return `⚠️ FreshTrack Alert: ${unitName} sensor is reporting a fault. Check device status.`;

    case "calibration_due":
      return `🔔 FreshTrack Notice: ${unitName} sensor is due for calibration.`;

    case "suspected_cooling_failure":
      return `🚨 FreshTrack Alert: ${unitName} may have a cooling failure. Temperature rising consistently. Check immediately.`;

    default:
      return `🔔 FreshTrack Alert: ${unitName} - ${getAlertTypeLabel(alertType)}. Please check.`;
  }
}

// ─── Escalation SMS Templates ────────────────────────────────────────────────

export interface EscalationSmsContext {
  unitName: string;
  siteName: string;
  alertType: string;
  stepNumber: number;
  elapsedMinutes: number;
  tempReading?: string | null;
}

/**
 * Build an SMS message for an escalation step.
 * Prefixed with escalation metadata. Truncated to 160 chars.
 */
export function buildEscalationSmsTemplate(ctx: EscalationSmsContext): string {
  const prefix = `[ESCALATION Step ${ctx.stepNumber} — Not ack'd after ${ctx.elapsedMinutes}m] `;
  const alertLabel = getAlertTypeLabel(ctx.alertType);

  let body: string;
  if (ctx.tempReading) {
    body = `${ctx.unitName}: ${alertLabel}. Current: ${ctx.tempReading}.`;
  } else {
    body = `${ctx.unitName} at ${ctx.siteName}: ${alertLabel}.`;
  }

  const msg = `${prefix}${body} Immediate action required.`;
  return msg.length > 160 ? msg.substring(0, 157) + "..." : msg;
}

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

export interface InAppNotificationContext {
  alertType: string;
  severity: string;
  unitName: string;
  siteName: string;
  areaName: string;
  message?: string | null;
  title?: string | null;
  tempReading?: string | null;
  tempLimit?: string | null;
  escalationStep?: number;
  acknowledgedBy?: string;
}

export function buildInAppTitle(ctx: InAppNotificationContext): string {
  const emoji = SEVERITY_EMOJI[ctx.severity] || "🔔";
  const alertLabel = getAlertTypeLabel(ctx.alertType);
  return `${emoji} ${alertLabel}: ${ctx.unitName}`;
}

export function buildInAppBody(ctx: InAppNotificationContext): string {
  if (ctx.escalationStep && ctx.escalationStep > 0) {
    return `Escalation Step ${ctx.escalationStep} — ${ctx.message || ctx.title || "Requires attention"}`;
  }
  return ctx.message || ctx.title || "Alert triggered — check unit status";
}

export function buildAckNotificationTitle(alertTitle: string): string {
  return `You acknowledged: ${alertTitle}`;
}

export function buildAckNotificationBody(notes?: string | null, ackTime?: string): string {
  if (notes) {
    return `Your acknowledgement note: "${notes}"`;
  }
  return `Alert acknowledged at ${ackTime || new Date().toLocaleString()}`;
}

// ─── Alert Detail Formatting (UI) ───────────────────────────────────────────

export interface AlertDetailContext {
  alertType: string;
  tempReading?: number | null;
  tempLimit?: number | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Format human-readable detail string for display in notification items.
 * Temperatures are in raw storage units (°F) — caller should convert if needed.
 */
export function formatAlertDetail(ctx: AlertDetailContext): string {
  const { alertType, tempReading, tempLimit, message, metadata } = ctx;

  if ((alertType === "temp_excursion" || alertType === "alarm_active") &&
      tempReading !== null && tempReading !== undefined &&
      tempLimit !== null && tempLimit !== undefined) {
    const direction = tempReading > tempLimit ? ">" : "<";
    return `Current ${tempReading.toFixed(1)}°F ${direction} Limit ${tempLimit.toFixed(1)}°F`;
  }

  if (alertType === "monitoring_interrupted") {
    const missed = metadata?.missed_checkins;
    if (missed) return `Missed ${missed} check-in${(missed as number) > 1 ? "s" : ""}`;
    return "No sensor data received";
  }

  if (alertType === "missed_manual_entry") return "Manual temperature log overdue";

  if (alertType === "low_battery") {
    const level = metadata?.battery_level;
    if (level !== undefined) return `Battery at ${level}%`;
    return "Battery level low";
  }

  if (alertType === "door_open") {
    const duration = metadata?.open_duration_minutes;
    if (duration) return `Door open for ${duration} minutes`;
    return "Door has been left open";
  }

  if (alertType === "suspected_cooling_failure") return "Temperature rising despite door closed";
  if (alertType === "sensor_fault") return "Sensor reporting errors";
  if (alertType === "calibration_due") return "Sensor calibration overdue";

  return message || "Alert triggered";
}
