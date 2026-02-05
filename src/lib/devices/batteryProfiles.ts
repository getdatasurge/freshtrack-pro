/**
 * Battery Profile Utilities
 * 
 * Types and utilities for production-grade battery life estimation
 * based on sensor model specifications.
 * 
 * Key principle: Voltage is the source of truth, percentage is derived.
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
  // Voltage curve fields
  chemistry?: string | null;
  nominal_voltage?: number | null;
  cutoff_voltage?: number | null;
  voltage_curve?: VoltageToPercentPoint[] | null;
}

export type BatteryChemistry = 
  | "CR17450"   // 3.0V Li-MnO₂ (flat discharge)
  | "LiFeS2_AA" // 1.5V Lithium-Iron Disulfide
  | "Alkaline_AA" // 1.5V Alkaline
  | "CR2032"   // 3.0V Coin cell
  | "LiPo";    // 3.7V Lithium Polymer

export type BatteryHealthState = 
  | "OK"
  | "WARNING"
  | "LOW"
  | "CRITICAL"
  | "REPLACE_ASAP";

export type BatteryWidgetState =
  | "NOT_CONFIGURED"
  | "MISSING_PROFILE"
  | "NO_BATTERY_DATA"
  | "COLLECTING_DATA"
  | "SENSOR_OFFLINE"
  | "ESTIMATE_LOW_CONFIDENCE"
  | "ESTIMATE_HIGH_CONFIDENCE"
  | "CRITICAL_BATTERY";

export type ConfidenceLevel = "none" | "low" | "high";

export interface VoltageToPercentPoint {
  voltage: number;
  percent: number;
}

export interface VoltageToPercentCurve {
  chemistry: BatteryChemistry;
  minVoltage: number;
  maxVoltage: number;
  curve: VoltageToPercentPoint[];
}

export interface BatteryEstimateResult {
  // Current state
  state: BatteryWidgetState;
  healthState: BatteryHealthState;
  currentSoc: number | null;
  currentVoltage: number | null;
  filteredVoltage: number | null;
  
  // Estimate (if available)
  estimatedDaysRemaining: number | null;
  estimatedReplacementDate: Date | null;
  confidence: ConfidenceLevel;
  voltageSlope: number | null; // V/day (negative = declining)
  
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
export const MIN_DAYS_FOR_VOLTAGE_ESTIMATE = 14; // Days of data for voltage-based estimate
export const CRITICAL_SOC_THRESHOLD = 10;
export const OFFLINE_MULTIPLIER = 3; // Sensor offline if no uplink in 3× interval
export const DEFAULT_INTERVAL_SECONDS = 900; // 15 min default
export const MAX_INTERVAL_SECONDS = 86400; // 24h max for inference
export const HYSTERESIS_READINGS = 3; // Readings needed for state upgrade

// Fallback profile for unknown models (pack-level voltages for 2×AA LiFeS2)
export const FALLBACK_BATTERY_PROFILE: Omit<BatteryProfile, "id" | "model"> = {
  manufacturer: "Generic",
  battery_type: "2×AA Lithium",
  nominal_capacity_mah: 3000,
  mah_per_uplink: 0.025,
  sleep_current_ua: 5,
  usable_capacity_pct: 85,
  replacement_threshold: 10,
  notes: "Conservative fallback for unknown models",
  chemistry: "LiFeS2_AA",
  nominal_voltage: 3.0,
  cutoff_voltage: 1.80,
};

// ============================================================================
// Voltage Curves (Chemistry-Specific)
// ============================================================================

/**
 * CR17450 (3.0V Li-MnO₂) - Flat discharge curve
 * Most battery life occurs at the ~2.85V plateau
 */
export const CR17450_CURVE: VoltageToPercentCurve = {
  chemistry: "CR17450",
  minVoltage: 2.50,
  maxVoltage: 3.00,
  curve: [
    { voltage: 3.00, percent: 100 },
    { voltage: 2.95, percent: 80 },
    { voltage: 2.85, percent: 50 },  // Mid-life plateau
    { voltage: 2.75, percent: 20 },  // Warning zone
    { voltage: 2.60, percent: 5 },   // Low
    { voltage: 2.50, percent: 0 },   // Replace ASAP
  ],
};

/**
 * LiFeS2 AA — 2× cells in series (pack voltage 1.80–3.60V)
 * Energizer Ultimate Lithium type, used by most Dragino/Milesight sensors
 * Sensors report total pack voltage, not per-cell voltage.
 */
export const LIFES2_AA_CURVE: VoltageToPercentCurve = {
  chemistry: "LiFeS2_AA",
  minVoltage: 1.80,
  maxVoltage: 3.60,
  curve: [
    { voltage: 3.60, percent: 100 },
    { voltage: 3.20, percent: 80 },
    { voltage: 2.80, percent: 50 },
    { voltage: 2.40, percent: 20 },
    { voltage: 2.00, percent: 5 },
    { voltage: 1.80, percent: 0 },
  ],
};

/**
 * CR2032 (3.0V Coin Cell)
 */
export const CR2032_CURVE: VoltageToPercentCurve = {
  chemistry: "CR2032",
  minVoltage: 2.20,
  maxVoltage: 3.00,
  curve: [
    { voltage: 3.00, percent: 100 },
    { voltage: 2.90, percent: 80 },
    { voltage: 2.70, percent: 50 },
    { voltage: 2.50, percent: 20 },
    { voltage: 2.30, percent: 5 },
    { voltage: 2.20, percent: 0 },
  ],
};

/**
 * Alkaline AA/AAA — 2× cells in series (pack voltage 1.60–3.20V)
 * Steeper discharge curve. Used by Dragino LDS02 and similar door sensors.
 * Sensors report total pack voltage, not per-cell voltage.
 */
export const ALKALINE_AA_CURVE: VoltageToPercentCurve = {
  chemistry: "Alkaline_AA",
  minVoltage: 1.60,
  maxVoltage: 3.20,
  curve: [
    { voltage: 3.20, percent: 100 },
    { voltage: 2.80, percent: 70 },
    { voltage: 2.40, percent: 40 },
    { voltage: 2.00, percent: 15 },
    { voltage: 1.80, percent: 5 },
    { voltage: 1.60, percent: 0 },
  ],
};

/**
 * Get voltage curve for chemistry type.
 * Case-insensitive to handle inconsistent values from sensor_catalog
 * (e.g. "lithium", "Lithium", "LiFeS2_AA" all map to LIFES2_AA_CURVE).
 */
export function getVoltageCurve(chemistry: string | null | undefined): VoltageToPercentCurve {
  const key = chemistry?.toLowerCase()?.trim();
  switch (key) {
    case "cr17450":
    case "li-mno2":
      return CR17450_CURVE;
    case "lifes2_aa":
    case "lifes2":
    case "lithium":
    case "li":
    case "li-fes2":
      return LIFES2_AA_CURVE;
    case "cr2032":
      return CR2032_CURVE;
    case "alkaline_aa":
    case "alkaline":
      return ALKALINE_AA_CURVE;
    default:
      return LIFES2_AA_CURVE; // Default to LiFeS2 AA — most common chemistry
  }
}

// ============================================================================
// Voltage to Percentage Conversion
// ============================================================================

/**
 * Convert voltage to estimated percentage using chemistry-specific curve
 * Uses linear interpolation between curve points
 */
export function voltageToPercent(voltage: number, chemistry: string | null | undefined): number {
  const curve = getVoltageCurve(chemistry);
  
  // Clamp to curve range
  if (voltage >= curve.maxVoltage) return 100;
  if (voltage <= curve.minVoltage) return 0;
  
  // Find the two curve points to interpolate between
  const points = curve.curve;
  for (let i = 0; i < points.length - 1; i++) {
    const high = points[i];
    const low = points[i + 1];
    
    if (voltage <= high.voltage && voltage >= low.voltage) {
      // Linear interpolation
      const range = high.voltage - low.voltage;
      const percentRange = high.percent - low.percent;
      const ratio = (voltage - low.voltage) / range;
      return Math.round(low.percent + (percentRange * ratio));
    }
  }
  
  return 0;
}

// ============================================================================
// Median Filter for Voltage Smoothing
// ============================================================================

/**
 * Apply median filter to readings for stable voltage
 */
export function medianFilter(values: number[], windowSize = 5): number | null {
  if (values.length === 0) return null;
  
  const window = values.slice(-windowSize);
  const sorted = [...window].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ============================================================================
// Battery Health State Machine
// ============================================================================

/**
 * Voltage thresholds for health state (CR17450 defaults)
 */
export interface VoltageThresholds {
  ok: number;       // Above this = OK
  warning: number;  // Above this = WARNING (below ok)
  low: number;      // Above this = LOW (below warning)
  critical: number; // Above this = CRITICAL (below low)
  // Below critical = REPLACE_ASAP
}

export function getVoltageThresholds(chemistry: string | null | undefined): VoltageThresholds {
  const key = chemistry?.toLowerCase()?.trim();
  switch (key) {
    case "cr17450":
    case "li-mno2":
      return { ok: 2.85, warning: 2.75, low: 2.60, critical: 2.50 };
    case "lifes2_aa":
    case "lifes2":
    case "lithium":
    case "li":
    case "li-fes2":
      // Pack-level (2× cells): 2.80V ok, 2.40V warning, 2.00V low, 1.80V critical
      return { ok: 2.80, warning: 2.40, low: 2.00, critical: 1.80 };
    case "cr2032":
      return { ok: 2.70, warning: 2.50, low: 2.30, critical: 2.20 };
    case "alkaline_aa":
    case "alkaline":
      // Pack-level (2× cells): 2.40V ok, 2.00V warning, 1.80V low, 1.60V critical
      return { ok: 2.40, warning: 2.00, low: 1.80, critical: 1.60 };
    default:
      // Default to LiFeS2_AA thresholds (most common chemistry)
      return { ok: 2.80, warning: 2.40, low: 2.00, critical: 1.80 };
  }
}

/**
 * Determine battery health state from voltage with hysteresis
 * Downgrades are immediate for safety, upgrades require consecutive readings
 */
export function determineBatteryHealthState(
  filteredVoltage: number | null,
  previousState: BatteryHealthState,
  recentVoltages: number[],
  chemistry: string | null | undefined
): BatteryHealthState {
  if (filteredVoltage === null || recentVoltages.length === 0) {
    return "OK"; // Default when no data
  }
  
  const thresholds = getVoltageThresholds(chemistry);
  const medianRecent = medianFilter(recentVoltages.slice(-HYSTERESIS_READINGS)) ?? filteredVoltage;
  
  // Immediate downgrade for safety (no hysteresis)
  if (medianRecent < thresholds.critical) return "REPLACE_ASAP";
  if (medianRecent < thresholds.low) return "CRITICAL";
  if (medianRecent < thresholds.warning) return "LOW";
  if (medianRecent < thresholds.ok) return "WARNING";
  
  // Hysteresis for upgrades (require consecutive readings above threshold)
  if (previousState !== "OK" && medianRecent >= thresholds.ok) {
    const allAbove = recentVoltages.slice(-HYSTERESIS_READINGS).every(v => v >= thresholds.ok);
    if (allAbove) return "OK";
    return previousState; // Stay in current state until consistent
  }
  
  return "OK";
}

// ============================================================================
// Voltage Trend & Remaining Life
// ============================================================================

/**
 * Calculate voltage slope (V/day) using linear regression
 */
export function calculateVoltageSlope(
  voltageReadings: Array<{ voltage: number; timestamp: string }>
): number | null {
  if (voltageReadings.length < 2) return null;
  
  // Need at least a few days of data
  const first = new Date(voltageReadings[0].timestamp).getTime();
  const last = new Date(voltageReadings[voltageReadings.length - 1].timestamp).getTime();
  const daySpan = (last - first) / (1000 * 60 * 60 * 24);
  
  if (daySpan < 1) return null; // Need at least 1 day
  
  // Simple linear regression
  const n = voltageReadings.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (const reading of voltageReadings) {
    const x = (new Date(reading.timestamp).getTime() - first) / (1000 * 60 * 60 * 24); // Days
    const y = reading.voltage;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  
  const denominator = (n * sumX2) - (sumX * sumX);
  if (denominator === 0) return 0;
  
  const slope = ((n * sumXY) - (sumX * sumY)) / denominator;
  return slope; // V/day (negative = declining)
}

/**
 * Estimate remaining days based on voltage trend
 */
export function estimateDaysFromVoltageSlope(
  currentVoltage: number,
  slope: number,
  cutoffVoltage: number
): number | null {
  // If not declining significantly, battery is stable
  if (slope >= -0.0001) return null; // Near-zero or positive slope
  
  const voltageRemaining = currentVoltage - cutoffVoltage;
  if (voltageRemaining <= 0) return 0;
  
  const daysRemaining = voltageRemaining / Math.abs(slope);
  return Math.floor(daysRemaining);
}

// ============================================================================
// Physics-Based Estimation (mAh model)
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

// ============================================================================
// Formatting Helpers
// ============================================================================

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
 * Format voltage for display
 */
export function formatVoltage(voltage: number | null): string {
  if (voltage === null) return "—";
  return `${voltage.toFixed(2)}V`;
}

/**
 * Format voltage slope for display
 */
export function formatVoltageSlope(slope: number | null): string {
  if (slope === null) return "—";
  if (Math.abs(slope) < 0.0001) return "Stable";
  const sign = slope > 0 ? "+" : "";
  return `${sign}${(slope * 1000).toFixed(1)} mV/day`;
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
    case "NO_BATTERY_DATA":
      return {
        title: "No battery data",
        description: "Sensor is reporting but no battery readings received yet.",
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

/**
 * Get health state display info
 */
export function getHealthStateInfo(state: BatteryHealthState): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (state) {
    case "OK":
      return { label: "OK", color: "text-safe", bgColor: "bg-safe/10" };
    case "WARNING":
      return { label: "Warning", color: "text-warning", bgColor: "bg-warning/10" };
    case "LOW":
      return { label: "Low", color: "text-warning", bgColor: "bg-warning/10" };
    case "CRITICAL":
      return { label: "Critical", color: "text-alarm", bgColor: "bg-alarm/10" };
    case "REPLACE_ASAP":
      return { label: "Replace ASAP", color: "text-alarm", bgColor: "bg-alarm/10" };
    default:
      return { label: "Unknown", color: "text-muted-foreground", bgColor: "bg-muted" };
  }
}
