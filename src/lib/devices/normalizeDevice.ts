/**
 * Device Normalization
 * Transforms raw sensor data into a standardized NormalizedDevice shape
 */

import type { LoraSensor } from "@/types/ttn";
import type { NormalizedDevice, DeviceCategory } from "./types";
import { SENSOR_TYPE_TO_CATEGORY } from "./types";
import { getDeviceDefinition, UNKNOWN_DEVICE } from "./deviceRegistry";

// ============================================================================
// Types for Site/Unit context
// ============================================================================

interface SiteContext {
  id: string;
  name: string;
}

interface UnitContext {
  id: string;
  name: string;
}

// ============================================================================
// Mismatch Detection
// ============================================================================

/**
 * Detects if there's a type mismatch between assigned sensor_type and resolved model category
 */
function detectMismatch(
  resolvedCategory: DeviceCategory,
  assignedSensorType: string | null | undefined
): { hasMismatch: boolean; reason?: string } {
  // No assigned type means no mismatch possible
  if (!assignedSensorType) {
    return { hasMismatch: false };
  }
  
  // Unknown category can't have a mismatch
  if (resolvedCategory === "unknown") {
    return { hasMismatch: false };
  }
  
  // Get expected category for the assigned sensor type
  const expectedCategory = SENSOR_TYPE_TO_CATEGORY[assignedSensorType];
  
  // If sensor type is not mapped, no mismatch
  if (!expectedCategory) {
    return { hasMismatch: false };
  }
  
  // Check if categories match
  if (expectedCategory !== resolvedCategory) {
    return {
      hasMismatch: true,
      reason: `Assigned as "${assignedSensorType}" but model indicates "${resolvedCategory}"`,
    };
  }
  
  return { hasMismatch: false };
}

// ============================================================================
// Normalization Function
// ============================================================================

/**
 * Normalize a LoraSensor into the standardized NormalizedDevice shape
 * 
 * @param sensor - Raw LoraSensor from database
 * @param siteData - Optional site context for name resolution
 * @param unitData - Optional unit context for name resolution
 * @param telemetryData - Optional telemetry data (from latest_telemetry or sensor_readings)
 */
export function normalizeEmulatorDevice(
  sensor: LoraSensor,
  siteData?: SiteContext | null,
  unitData?: UnitContext | null,
  telemetryData?: Record<string, unknown>
): NormalizedDevice {
  // 1. Lookup model in registry (fallback to UNKNOWN_DEVICE)
  const resolvedModel = getDeviceDefinition(sensor.model);
  const isUnknownModel = resolvedModel === UNKNOWN_DEVICE;
  
  // 2. Detect type mismatch
  const { hasMismatch, reason: mismatchReason } = detectMismatch(
    resolvedModel.category,
    sensor.sensor_type
  );
  
  // 3. Build normalized device
  return {
    // Core identity
    id: sensor.id,
    name: sensor.name,
    model: sensor.model,
    
    // Registry resolution
    resolvedModel,
    category: resolvedModel.category,
    isUnknownModel,
    
    // Type mismatch
    hasMismatch,
    mismatchReason,
    
    // Location context
    siteId: sensor.site_id,
    siteName: siteData?.name ?? null,
    unitId: sensor.unit_id,
    unitName: unitData?.name ?? null,
    
    // Device identifiers
    devEui: sensor.dev_eui,
    ttnDeviceId: sensor.ttn_device_id,
    
    // OTAA credentials
    appEui: sensor.app_eui,
    appKey: sensor.app_key,
    credentialsGenerated: sensor.provisioned_source === "emulator",
    
    // Status information
    status: sensor.status,
    provisioningState: sensor.provisioning_state,
    lastSeenAt: sensor.last_seen_at,
    lastJoinAt: sensor.last_join_at,
    batteryLevel: sensor.battery_level,
    signalStrength: sensor.signal_strength,
    
    // Telemetry data
    telemetry: telemetryData ?? {},
  };
}

// ============================================================================
// Batch Normalization
// ============================================================================

/**
 * Normalize multiple sensors at once
 */
export function normalizeDevices(
  sensors: LoraSensor[],
  siteMap?: Map<string, SiteContext>,
  unitMap?: Map<string, UnitContext>,
  telemetryMap?: Map<string, Record<string, unknown>>
): NormalizedDevice[] {
  return sensors.map((sensor) => {
    const siteData = sensor.site_id ? siteMap?.get(sensor.site_id) : null;
    const unitData = sensor.unit_id ? unitMap?.get(sensor.unit_id) : null;
    const telemetry = telemetryMap?.get(sensor.id);
    
    return normalizeEmulatorDevice(sensor, siteData, unitData, telemetry);
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get display status label for a normalized device
 */
export function getDeviceStatusLabel(device: NormalizedDevice): string {
  switch (device.status) {
    case "active":
      return "Active";
    case "offline":
      return "Offline";
    case "pending":
      return "Pending";
    case "joining":
      return "Joining";
    case "fault":
      return "Fault";
    default:
      return device.status || "Unknown";
  }
}

/**
 * Get status color class for a normalized device
 */
export function getDeviceStatusColor(device: NormalizedDevice): string {
  switch (device.status) {
    case "active":
      return "text-green-500";
    case "offline":
      return "text-muted-foreground";
    case "pending":
      return "text-yellow-500";
    case "joining":
      return "text-blue-500";
    case "fault":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Check if device has any telemetry data
 */
export function hasTelemetry(device: NormalizedDevice): boolean {
  return Object.keys(device.telemetry).length > 0;
}
