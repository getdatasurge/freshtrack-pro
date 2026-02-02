/**
 * Battery Profile Utilities
 * 
 * Types and utilities for production-grade battery life estimation
 * based on sensor model specifications.
 */

// ============================================================================
// Types
// ============================================================================

export interface BatteryProfile {
  id: string;
  model: string;
  manufacturer: string | null;
  battery_type: string;
  nominal_capacity_mah: number;
  mah_per_uplink: number;
  sleep_current_ua: number;
  usable_capacity_pct: number;
  replacement_threshold: number;
  notes: string | null;
}

export type BatteryWidgetState =
  | "NOT_CONFIGURED"
  | "MISSING_PROFILE"
  | "COLLECTING_DATA"
  | "SENSOR_OFFLINE"
  | "ESTIMATE_LOW_CONFIDENCE"
  | "ESTIMATE_HIGH_CONFIDENCE"
  | "CRITICAL_BATTERY";

export type ConfidenceLevel = "none" | "low" | "high";

export interface BatteryEstimateResult {
  // Current state
  state: BatteryWidgetState;
  currentSoc: number | null;
  
  // Estimate (if available)
  estimatedDaysRemaining: number | null;
  estimatedReplacementDate: Date | null;
  confidence: ConfidenceLevel;
  
  // Profile info
  batteryProfile: BatteryProfile | null;
  profileSource: "database" | "fallback" | "none";
  
  // Uplink analysis
  inferredIntervalSeconds: number | null;
  configuredIntervalSeconds: number | null;
  uplinkCount: number;
  dataSpanHours: number;
  dailyConsumptionMah: number | null;
  
  // Loading state
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Constants
// ============================================================================

export const MIN_UPLINKS_FOR_ESTIMATE = 12;
export const MIN_HOURS_FOR_ESTIMATE = 6;
export const MIN_UPLINKS_HIGH_CONFIDENCE = 50;
export const MIN_HOURS_HIGH_CONFIDENCE = 48;
export const CRITICAL_SOC_THRESHOLD = 10;
export const OFFLINE_MULTIPLIER = 3; // Sensor offline if no uplink in 3× interval
export const DEFAULT_INTERVAL_SECONDS = 900; // 15 min default
export const MAX_INTERVAL_SECONDS = 86400; // 24h max for inference

// Fallback profile for unknown models
export const FALLBACK_BATTERY_PROFILE: Omit<BatteryProfile, "id" | "model"> = {
  manufacturer: "Generic",
  battery_type: "2×AA Lithium",
  nominal_capacity_mah: 3000,
  mah_per_uplink: 0.025,
  sleep_current_ua: 5,
  usable_capacity_pct: 85,
  replacement_threshold: 10,
  notes: "Conservative fallback for unknown models",
};

// ============================================================================
// Estimation Logic
// ============================================================================

export interface EstimationInput {
  currentSoc: number;
  effectiveIntervalSeconds: number;
  profile: BatteryProfile;
}

/**
 * Calculate estimated battery life using physics-based model
 */
export function calculateBatteryEstimate(input: EstimationInput): {
  daysRemaining: number;
  dailyConsumptionMah: number;
  replacementDate: Date;
} {
  const { currentSoc, effectiveIntervalSeconds, profile } = input;
  
  // Uplinks per day
  const uplinksPerDay = 86400 / effectiveIntervalSeconds;
  
  // Daily consumption calculations
  const dailySleepConsumption = (profile.sleep_current_ua * 24) / 1000; // µA → mAh
  const dailyUplinkConsumption = uplinksPerDay * profile.mah_per_uplink;
  const dailyConsumptionMah = dailySleepConsumption + dailyUplinkConsumption;
  
  // Usable capacity
  const usableCapacity = profile.nominal_capacity_mah * (profile.usable_capacity_pct / 100);
  
  // Remaining capacity (accounting for replacement threshold)
  const effectiveSoc = Math.max(0, currentSoc - profile.replacement_threshold);
  const remainingCapacity = usableCapacity * (effectiveSoc / 100);
  
  // Days remaining
  const daysRemaining = dailyConsumptionMah > 0 
    ? Math.floor(remainingCapacity / dailyConsumptionMah)
    : 0;
  
  // Replacement date
  const replacementDate = new Date();
  replacementDate.setDate(replacementDate.getDate() + daysRemaining);
  
  return {
    daysRemaining: Math.max(0, daysRemaining),
    dailyConsumptionMah,
    replacementDate,
  };
}

/**
 * Calculate median uplink interval from timestamps
 */
export function inferUplinkInterval(timestamps: string[]): number | null {
  if (timestamps.length < 2) return null;
  
  // Calculate deltas between consecutive timestamps
  const deltas: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    const delta = (new Date(timestamps[i]).getTime() - new Date(timestamps[i - 1]).getTime()) / 1000;
    // Only include reasonable intervals (1 min to 24 hours)
    if (delta >= 60 && delta <= MAX_INTERVAL_SECONDS) {
      deltas.push(delta);
    }
  }
  
  if (deltas.length === 0) return null;
  
  // Return median
  deltas.sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  return deltas.length % 2 === 0
    ? Math.floor((deltas[mid - 1] + deltas[mid]) / 2)
    : deltas[mid];
}

/**
 * Determine confidence level based on data availability
 */
export function determineConfidence(uplinkCount: number, dataSpanHours: number): ConfidenceLevel {
  if (uplinkCount < MIN_UPLINKS_FOR_ESTIMATE || dataSpanHours < MIN_HOURS_FOR_ESTIMATE) {
    return "none";
  }
  if (uplinkCount >= MIN_UPLINKS_HIGH_CONFIDENCE && dataSpanHours >= MIN_HOURS_HIGH_CONFIDENCE) {
    return "high";
  }
  return "low";
}

/**
 * Check if sensor is offline based on last seen time
 */
export function isSensorOffline(
  lastSeenAt: string | null,
  expectedIntervalSeconds: number
): boolean {
  if (!lastSeenAt) return true;
  
  const lastSeen = new Date(lastSeenAt).getTime();
  const now = Date.now();
  const offlineThreshold = expectedIntervalSeconds * OFFLINE_MULTIPLIER * 1000;
  
  return (now - lastSeen) > offlineThreshold;
}

/**
 * Format battery estimate for display
 */
export function formatEstimate(daysRemaining: number | null, confidence: ConfidenceLevel): string {
  if (daysRemaining === null) return "—";
  
  const prefix = confidence === "low" ? "~" : "";
  
  if (daysRemaining === 0) return "Replace now";
  if (daysRemaining <= 7) return `${prefix}${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  if (daysRemaining <= 60) {
    const weeks = Math.round(daysRemaining / 7);
    return `${prefix}${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  if (daysRemaining <= 365) {
    const months = Math.round(daysRemaining / 30);
    return `${prefix}${months} month${months === 1 ? "" : "s"}`;
  }
  
  return `${prefix}12+ months`;
}

/**
 * Format daily consumption for display
 */
export function formatDailyConsumption(mah: number): string {
  if (mah < 1) {
    return `${(mah * 1000).toFixed(0)} µAh/day`;
  }
  return `${mah.toFixed(2)} mAh/day`;
}

/**
 * Get state-specific user message
 */
export function getStateMessage(state: BatteryWidgetState): {
  title: string;
  description: string;
} {
  switch (state) {
    case "NOT_CONFIGURED":
      return {
        title: "No sensor assigned",
        description: "Assign a sensor to monitor battery health.",
      };
    case "MISSING_PROFILE":
      return {
        title: "Battery estimate unavailable",
        description: "Battery profile not configured for this sensor model.",
      };
    case "COLLECTING_DATA":
      return {
        title: "Collecting data",
        description: "Requires 6 hours of readings to estimate battery life.",
      };
    case "SENSOR_OFFLINE":
      return {
        title: "Sensor offline",
        description: "Battery estimate unavailable while sensor is offline.",
      };
    case "CRITICAL_BATTERY":
      return {
        title: "Replace battery now",
        description: "Battery level is critically low.",
      };
    case "ESTIMATE_LOW_CONFIDENCE":
      return {
        title: "Low confidence estimate",
        description: "More data needed for accurate prediction.",
      };
    case "ESTIMATE_HIGH_CONFIDENCE":
      return {
        title: "Battery health",
        description: "Estimate based on observed usage pattern.",
      };
  }
}
