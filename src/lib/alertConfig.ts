/**
 * Unified alert configuration - SINGLE SOURCE OF TRUTH
 * 
 * All alert type and severity display configuration should import from here.
 * Do NOT create local copies of these configs in components.
 */

import {
  AlertTriangle,
  Thermometer,
  WifiOff,
  Clock,
  Battery,
  type LucideIcon,
} from "lucide-react";

/**
 * Alert type display configuration
 * Maps alert_type enum values to icons and labels
 */
export const ALERT_TYPE_CONFIG: Record<string, { icon: LucideIcon; label: string; clearText: string }> = {
  // Database alert types (snake_case)
  alarm_active: { icon: Thermometer, label: "Temperature Alarm", clearText: "Temperature returns to range" },
  monitoring_interrupted: { icon: WifiOff, label: "Monitoring Interrupted", clearText: "Sensor comes back online" },
  missed_manual_entry: { icon: Clock, label: "Missed Manual Entry", clearText: "Log a temperature reading" },
  low_battery: { icon: Battery, label: "Low Battery", clearText: "Replace or charge battery" },
  sensor_fault: { icon: AlertTriangle, label: "Sensor Fault", clearText: "Sensor issue resolved" },
  door_open: { icon: AlertTriangle, label: "Door Open", clearText: "Close the door" },
  calibration_due: { icon: AlertTriangle, label: "Calibration Due", clearText: "Calibrate the sensor" },
  temp_excursion: { icon: Thermometer, label: "Temperature Excursion", clearText: "Temperature returns to range" },
  suspected_cooling_failure: { icon: Thermometer, label: "Suspected Cooling Failure", clearText: "Cooling system restored" },
  
  // Computed alert types (UPPER_CASE - frontend only)
  MANUAL_REQUIRED: { icon: Clock, label: "Manual Logging Required", clearText: "Log a temperature reading" },
  OFFLINE: { icon: WifiOff, label: "Sensor Offline", clearText: "Sensor comes back online" },
  EXCURSION: { icon: Thermometer, label: "Temperature Excursion", clearText: "Temperature returns to range" },
  ALARM_ACTIVE: { icon: Thermometer, label: "Temperature Alarm", clearText: "Temperature returns to range" },
  TEMP_EXCURSION: { icon: Thermometer, label: "Temperature Excursion", clearText: "Temperature returns to range" },
};

/**
 * Severity display configuration
 * Maps severity levels to colors
 */
export const SEVERITY_CONFIG: Record<string, { color: string; bgColor: string }> = {
  info: { color: "text-accent", bgColor: "bg-accent/10" },
  warning: { color: "text-warning", bgColor: "bg-warning/10" },
  critical: { color: "text-alarm", bgColor: "bg-alarm/10" },
};

/**
 * Get alert type config with fallback
 */
export function getAlertTypeConfig(alertType: string) {
  return ALERT_TYPE_CONFIG[alertType] || ALERT_TYPE_CONFIG.sensor_fault;
}

/**
 * Get severity config with fallback
 */
export function getSeverityConfig(severity: string) {
  return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.warning;
}

/**
 * Get clear condition text for an alert type
 */
export function getAlertClearCondition(alertType: string): string {
  return ALERT_TYPE_CONFIG[alertType]?.clearText || "Condition resolved";
}
