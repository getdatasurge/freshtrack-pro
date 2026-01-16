/**
 * Device Registry Type Definitions
 * Core types for the registry-driven device rendering system
 */

import type { LucideIcon } from "lucide-react";

// ============================================================================
// Device Categories
// ============================================================================

export type DeviceCategory =
  | "motion"
  | "temperature"
  | "leak"
  | "metering"
  | "door"
  | "gps"
  | "air_quality"
  | "multi_sensor"
  | "unknown";

// ============================================================================
// Telemetry Field Definitions
// ============================================================================

export type TelemetryFieldType = "number" | "boolean" | "string" | "datetime";

export interface TelemetryFieldDefinition {
  /** Field key in telemetry data (e.g., 'temperature') */
  key: string;
  /** Human-readable label (e.g., 'Temperature') */
  label: string;
  /** Unit suffix (e.g., '°C', '%', 'ppm') */
  unit: string;
  /** Custom formatter function */
  formatter?: (value: unknown) => string;
  /** Value to show when field is missing */
  emptyValue: string;
  /** Data type for validation/rendering */
  type: TelemetryFieldType;
  /** Priority for display ordering (lower = higher priority) */
  priority?: number;
}

// ============================================================================
// Device Capabilities
// ============================================================================

export interface DeviceCapabilities {
  temperature?: boolean;
  humidity?: boolean;
  door?: boolean;
  motion?: boolean;
  leak?: boolean;
  battery?: boolean;
  gps?: boolean;
  co2?: boolean;
  voc?: boolean;
  distance?: boolean;
  pulse?: boolean;
  tamper?: boolean;
}

// ============================================================================
// Device Definition (Registry Entry)
// ============================================================================

export interface DeviceDefinition {
  /** Model identifier - MUST match emulator model field */
  model: string;
  /** Human-readable display name */
  displayName: string;
  /** Device category */
  category: DeviceCategory;
  /** Manufacturer name */
  manufacturer?: string;
  /** Primary icon for this specific model */
  modelIcon: LucideIcon;
  /** Fallback category icon */
  categoryIcon: LucideIcon;
  /** Telemetry fields this device reports */
  telemetryFields: TelemetryFieldDefinition[];
  /** Device capabilities flags */
  capabilities: DeviceCapabilities;
  /** Optional description */
  description?: string;
}

// ============================================================================
// Category Definition
// ============================================================================

export interface CategoryDefinition {
  /** Human-readable category label */
  label: string;
  /** Category icon */
  icon: LucideIcon;
  /** Tailwind color class */
  color: string;
  /** Background color class for badges */
  bgColor: string;
  /** Category description */
  description: string;
}

// ============================================================================
// Normalized Device (Output of normalization)
// ============================================================================

export interface NormalizedDevice {
  // Core identity
  id: string;
  name: string;
  model: string | null;
  
  // Registry resolution
  resolvedModel: DeviceDefinition;
  category: DeviceCategory;
  isUnknownModel: boolean;
  
  // Type mismatch detection
  hasMismatch: boolean;
  mismatchReason?: string;
  
  // Location context
  siteId: string | null;
  siteName: string | null;
  unitId: string | null;
  unitName: string | null;
  
  // Device identifiers
  devEui: string;
  ttnDeviceId: string | null;
  
  // OTAA credentials
  appEui: string | null;
  appKey: string | null;
  credentialsGenerated?: boolean;
  
  // Status information
  status: string;
  provisioningState: string;
  lastSeenAt: string | null;
  lastJoinAt: string | null;
  batteryLevel: number | null;
  signalStrength: number | null;
  
  // Telemetry data (raw values)
  telemetry: Record<string, unknown>;
}

// ============================================================================
// Sensor Type Mapping (for mismatch detection)
// ============================================================================

/** Maps sensor_type values to their expected categories */
export const SENSOR_TYPE_TO_CATEGORY: Record<string, DeviceCategory> = {
  temperature: "temperature",
  temperature_humidity: "temperature",
  door: "door",
  combo: "multi_sensor",
  contact: "door",
  motion: "motion",
  leak: "leak",
  metering: "metering",
  gps: "gps",
  air_quality: "air_quality",
  multi_sensor: "multi_sensor",
};
