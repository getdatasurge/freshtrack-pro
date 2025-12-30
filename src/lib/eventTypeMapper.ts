import {
  Radio,
  AlertTriangle,
  ClipboardCheck,
  Settings,
  Bell,
  Activity,
  Thermometer,
  WifiOff,
  Battery,
  DoorOpen,
  Snowflake,
  Wrench,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  MessageSquare,
  Send,
  Eye,
  EyeOff,
  User,
  type LucideIcon,
} from "lucide-react";

// Event type to human-readable labels
export const eventTypeLabels: Record<string, string> = {
  // Device/Telemetry
  sensor_paired: "Sensor Paired",
  sensor_unpaired: "Sensor Unpaired",
  reading_received: "Reading Received",
  device_offline: "Device Went Offline",
  device_online: "Device Came Online",
  door_opened: "Door Opened",
  door_closed: "Door Closed",
  battery_updated: "Battery Level Updated",
  signal_updated: "Signal Strength Updated",
  
  // Alert Lifecycle
  alert_created: "Alert Created",
  alert_activated: "Alert Activated",
  alert_escalated: "Alert Escalated",
  alert_acknowledged: "Alert Acknowledged",
  alert_resolved: "Alert Resolved",
  ALERT_ACTIVE: "Alert Activated",
  ALERT_ACKNOWLEDGED: "Alert Acknowledged",
  ALERT_RESOLVED: "Alert Resolved",
  
  // Compliance
  manual_temp_logged: "Temperature Logged",
  missed_manual_log: "Manual Log Missed",
  excursion_started: "Temperature Excursion Started",
  excursion_confirmed: "Temperature Excursion Confirmed",
  excursion_cleared: "Temperature Excursion Cleared",
  
  // Settings
  unit_settings_updated: "Unit Settings Updated",
  unit_thresholds_updated: "Unit Thresholds Updated",
  alert_rules_updated: "Alert Rules Updated",
  notification_settings_updated: "Notification Settings Updated",
  
  // Notifications
  notification_sent: "Notification Sent",
  notification_failed: "Notification Failed",
  notification_suppressed: "Notification Suppressed",
  notification_enqueued: "Notification Queued",
  notification_delivered: "Notification Delivered",
  SENT: "Notification Sent",
  FAILED: "Notification Failed",
  SKIPPED: "Notification Skipped",
  
  // System
  sensor_simulation: "Simulator Action",
  unit_state_change: "Unit State Changed",
  report_exported: "Report Exported",
  user_login: "User Login",
  user_logout: "User Logout",
  
  // TTN Settings
  "ttn.settings.updated": "TTN Settings Updated",
  "ttn.settings.enabled": "TTN Integration Enabled",
  "ttn.settings.disabled": "TTN Integration Disabled",
  "ttn.settings.tested": "TTN Connection Tested",
  "ttn.settings.test_failed": "TTN Connection Test Failed",
};

// Event categories with icons and colors
export type EventCategory = 
  | "device"
  | "alert"
  | "compliance"
  | "settings"
  | "notification"
  | "system";

export interface CategoryConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  label: string;
}

export const categoryConfig: Record<EventCategory, CategoryConfig> = {
  device: {
    icon: Radio,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Device",
  },
  alert: {
    icon: AlertTriangle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Alert",
  },
  compliance: {
    icon: ClipboardCheck,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    label: "Compliance",
  },
  settings: {
    icon: Settings,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    label: "Settings",
  },
  notification: {
    icon: Bell,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    label: "Notification",
  },
  system: {
    icon: Activity,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    label: "System",
  },
};

// Severity configurations
export type EventSeverity = "info" | "warning" | "critical" | "success" | "failure";

export interface SeverityConfig {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}

export const severityConfig: Record<EventSeverity, SeverityConfig> = {
  info: {
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    label: "Info",
  },
  warning: {
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    label: "Warning",
  },
  critical: {
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    label: "Critical",
  },
  success: {
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    label: "Success",
  },
  failure: {
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    label: "Failure",
  },
};

// Event type to icon mapping
export const eventTypeIcons: Record<string, LucideIcon> = {
  // Device
  sensor_paired: Radio,
  sensor_unpaired: Radio,
  reading_received: Thermometer,
  device_offline: WifiOff,
  device_online: Radio,
  door_opened: DoorOpen,
  door_closed: DoorOpen,
  battery_updated: Battery,
  
  // Alert
  alert_created: AlertTriangle,
  alert_activated: AlertTriangle,
  alert_escalated: AlertTriangle,
  alert_acknowledged: CheckCircle2,
  alert_resolved: CheckCircle2,
  ALERT_ACTIVE: AlertTriangle,
  ALERT_ACKNOWLEDGED: CheckCircle2,
  ALERT_RESOLVED: CheckCircle2,
  
  // Compliance
  manual_temp_logged: ClipboardCheck,
  missed_manual_log: Clock,
  excursion_started: Thermometer,
  excursion_confirmed: Thermometer,
  excursion_cleared: CheckCircle2,
  
  // Settings
  unit_settings_updated: Settings,
  unit_thresholds_updated: Thermometer,
  alert_rules_updated: Settings,
  notification_settings_updated: Bell,
  
  // Notifications
  notification_sent: Send,
  notification_failed: XCircle,
  notification_suppressed: EyeOff,
  notification_enqueued: Mail,
  notification_delivered: CheckCircle2,
  SENT: Send,
  FAILED: XCircle,
  SKIPPED: EyeOff,
  
  // System
  sensor_simulation: Activity,
  unit_state_change: Activity,
  report_exported: ClipboardCheck,
  user_login: User,
  user_logout: User,
  
  // TTN Settings
  "ttn.settings.updated": Settings,
  "ttn.settings.enabled": Radio,
  "ttn.settings.disabled": Radio,
  "ttn.settings.tested": CheckCircle2,
  "ttn.settings.test_failed": XCircle,
};

// Infer category from event type
export function inferCategory(eventType: string): EventCategory {
  if (eventType.includes("sensor") || eventType.includes("device") || eventType.includes("door") || eventType.includes("battery") || eventType.includes("signal") || eventType.includes("reading")) {
    return "device";
  }
  if (eventType.includes("alert") || eventType.includes("ALERT")) {
    return "alert";
  }
  if (eventType.includes("manual") || eventType.includes("excursion") || eventType.includes("temp_logged")) {
    return "compliance";
  }
  if (eventType.includes("settings") || eventType.includes("thresholds") || eventType.includes("rules") || eventType.startsWith("ttn.")) {
    return "settings";
  }
  if (eventType.includes("notification") || eventType.includes("SENT") || eventType.includes("FAILED") || eventType.includes("SKIPPED")) {
    return "notification";
  }
  return "system";
}

// Infer severity from event type and data
export function inferSeverity(eventType: string, eventData?: Record<string, any>): EventSeverity {
  if (eventType.includes("failed") || eventType.includes("FAILED") || eventType.includes("fault") || eventType.includes("offline")) {
    return "failure";
  }
  if (eventType.includes("resolved") || eventType.includes("RESOLVED") || eventType.includes("cleared") || eventType.includes("delivered") || eventType.includes("SENT")) {
    return "success";
  }
  if (eventType.includes("escalated") || eventType.includes("critical") || eventType.includes("alarm")) {
    return "critical";
  }
  if (eventType.includes("warning") || eventType.includes("SKIPPED") || eventType.includes("suppressed")) {
    return "warning";
  }
  return "info";
}

// Get human-readable label for event type
export function getEventLabel(eventType: string): string {
  return eventTypeLabels[eventType] || eventType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// Get icon for event type
export function getEventIcon(eventType: string): LucideIcon {
  return eventTypeIcons[eventType] || Activity;
}
