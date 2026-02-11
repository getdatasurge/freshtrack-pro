/**
 * Deterministic sensor status calculation.
 *
 * Status is always computed client-side from:
 *   last_seen_at + expected uplink interval + now()
 *
 * Interval resolution priority:
 *   1. sensor_configurations.uplink_interval_s  (per-sensor override)
 *   2. sensor_catalog.uplink_info.default_interval_s  (catalog default)
 *   3. Type-based fallback (temp=600s, door/contact=86400s, other=3600s)
 */

import type { LoraSensorType } from "@/types/ttn";
import type { SensorCatalogUplinkInfo } from "@/types/sensorCatalog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Display status computed purely from timestamps + intervals.
 * This replaces the stored `status` field for display purposes.
 */
export type ComputedSensorDisplayStatus =
  | "pending"        // Not yet provisioned
  | "joining"        // Provisioned, awaiting first uplink
  | "online"         // last_seen_at within 1.5x interval
  | "late"           // last_seen_at between 1.5x and 3x interval
  | "not_reporting"  // last_seen_at exceeds 3x interval
  | "error"          // System-level fault (provisioning failure, TTN error)
  | "never";         // Provisioned/active but last_seen_at is null

export interface SensorStatusInput {
  /** Stored DB status (pending | joining | active | offline | fault) */
  dbStatus: string;
  /** Sensor type for fallback interval */
  sensorType: LoraSensorType;
  /** Last uplink timestamp (ISO string or null) */
  lastSeenAt: string | null;
  /** TTN provisioning state */
  provisioningState: string;
  /** Per-sensor uplink_interval_s from sensor_configurations (may be null) */
  configIntervalS: number | null;
  /** Catalog uplink_info for this sensor's model (may be null) */
  catalogUplinkInfo: SensorCatalogUplinkInfo | null;
}

export interface SensorStatusResult {
  status: ComputedSensorDisplayStatus;
  /** The resolved expected interval in seconds */
  expectedIntervalS: number;
  /** Human-readable source of the interval value */
  intervalSource: "sensor_config" | "catalog" | "type_fallback";
}

// ---------------------------------------------------------------------------
// Fallback intervals by sensor type (seconds)
// ---------------------------------------------------------------------------

const TYPE_FALLBACK_INTERVALS: Record<string, number> = {
  temperature: 600,           // 10 min
  temperature_humidity: 600,  // 10 min
  door: 86400,                // 24 hours (daily heartbeat)
  contact: 86400,             // 24 hours (daily heartbeat)
};

const DEFAULT_FALLBACK_INTERVAL_S = 3600; // 1 hour for everything else

// ---------------------------------------------------------------------------
// Interval resolution
// ---------------------------------------------------------------------------

/**
 * Resolve expected uplink interval using the priority chain:
 *   1. Per-sensor config override
 *   2. Catalog default_interval_s
 *   3. Type-based fallback
 */
export function resolveExpectedInterval(
  sensorType: LoraSensorType,
  configIntervalS: number | null,
  catalogUplinkInfo: SensorCatalogUplinkInfo | null,
): { intervalS: number; source: SensorStatusResult["intervalSource"] } {
  if (configIntervalS != null && configIntervalS > 0) {
    return { intervalS: configIntervalS, source: "sensor_config" };
  }

  const catalogDefault = catalogUplinkInfo?.default_interval_s;
  if (catalogDefault != null && catalogDefault > 0) {
    return { intervalS: catalogDefault, source: "catalog" };
  }

  const fallback =
    TYPE_FALLBACK_INTERVALS[sensorType] ?? DEFAULT_FALLBACK_INTERVAL_S;
  return { intervalS: fallback, source: "type_fallback" };
}

// ---------------------------------------------------------------------------
// Status computation
// ---------------------------------------------------------------------------

/**
 * Compute display status deterministically from sensor data.
 *
 * Rules:
 *   - pending / joining are pass-through from DB + provisioning state
 *   - fault (Error) is only for system-level issues
 *   - never = provisioned but never received data
 *   - online / late / not_reporting are based on elapsed time vs interval
 */
export function computeSensorDisplayStatus(
  input: SensorStatusInput,
  now: Date = new Date(),
): SensorStatusResult {
  const { dbStatus, sensorType, lastSeenAt, provisioningState, configIntervalS, catalogUplinkInfo } = input;

  const { intervalS, source } = resolveExpectedInterval(
    sensorType,
    configIntervalS,
    catalogUplinkInfo,
  );

  const base: Omit<SensorStatusResult, "status"> = {
    expectedIntervalS: intervalS,
    intervalSource: source,
  };

  // --- Pass-through statuses ---

  // Pending: not yet provisioned
  if (dbStatus === "pending" && provisioningState !== "exists_in_ttn") {
    return { ...base, status: "pending" };
  }

  // Joining: provisioned in TTN but hasn't sent data yet
  if (
    (dbStatus === "pending" && provisioningState === "exists_in_ttn") ||
    dbStatus === "joining"
  ) {
    // If we already have an uplink, fall through to time-based check
    if (!lastSeenAt) {
      return { ...base, status: "joining" };
    }
  }

  // Error: system-level fault only
  if (dbStatus === "fault") {
    return { ...base, status: "error" };
  }

  // --- Time-based statuses ---

  // Never received data
  if (!lastSeenAt) {
    return { ...base, status: "never" };
  }

  const lastSeenMs = new Date(lastSeenAt).getTime();
  const elapsedMs = now.getTime() - lastSeenMs;
  const intervalMs = intervalS * 1000;

  if (elapsedMs <= intervalMs * 1.5) {
    return { ...base, status: "online" };
  }

  if (elapsedMs <= intervalMs * 3) {
    return { ...base, status: "late" };
  }

  return { ...base, status: "not_reporting" };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format an interval in seconds to a human-readable string.
 * Examples: "10 min", "1 hour", "24 hours", "2 min"
 */
export function formatIntervalHuman(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.round(seconds / 60);
    return `${mins} min`;
  }
  const hours = seconds / 3600;
  if (Number.isInteger(hours)) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  // Non-integer hours: show as e.g. "1.5 hours"
  return `${hours.toFixed(1)} hours`;
}

const INTERVAL_SOURCE_LABELS: Record<SensorStatusResult["intervalSource"], string> = {
  sensor_config: "Sensor config",
  catalog: "Catalog default",
  type_fallback: "Type default",
};

export function formatIntervalSource(source: SensorStatusResult["intervalSource"]): string {
  return INTERVAL_SOURCE_LABELS[source];
}
