/**
 * Payload Inference Engine
 * 
 * Deterministic payload type classification with confidence scoring,
 * explainable reasons, and ambiguity detection.
 */

import type { InferenceResult, InferenceReason } from "./eventTypes.ts";

// ============================================================================
// REGISTRY VERSION
// ============================================================================

/** Current version of the payload registry schema */
export const REGISTRY_VERSION = "1.0.0";

// ============================================================================
// DISCRIMINATOR DEFINITIONS
// ============================================================================

/**
 * Maps discriminator fields to their associated payload types and models.
 * Priority is determined by specificity (more unique fields = higher priority).
 */
interface DiscriminatorEntry {
  payloadType: string;
  sensorType: string;
  models: string[];
  priority: number;
  requiredFields?: string[];
}

/**
 * Discriminator matrix - maps field names to possible types.
 * Higher priority = more specific/reliable match.
 */
const DISCRIMINATOR_MATRIX: Record<string, DiscriminatorEntry> = {
  // Door sensors - very distinctive (highest priority)
  "door_status": {
    payloadType: "door_v1",
    sensorType: "door",
    models: ["LDS02", "EM300-MCS"],
    priority: 100,
  },
  "door": {
    payloadType: "door_v1",
    sensorType: "door",
    models: ["R311A"],
    priority: 100,
  },
  "open_close": {
    payloadType: "door_v1",
    sensorType: "door",
    models: ["DS3604"],
    priority: 100,
  },
  
  // Leak detection - safety critical (high priority)
  "water_leak": {
    payloadType: "leak_v1",
    sensorType: "leak",
    models: ["LDDS75"],
    priority: 95,
  },
  "leak": {
    payloadType: "leak_v1",
    sensorType: "leak",
    models: ["R718WA2"],
    priority: 95,
  },
  
  // Motion sensors (high priority)
  "motion": {
    payloadType: "motion_v1",
    sensorType: "motion",
    models: ["TBMS100"],
    priority: 90,
  },
  "occupancy": {
    payloadType: "motion_v1",
    sensorType: "motion",
    models: [],
    priority: 90,
  },
  
  // Air quality - distinctive combo fields (higher than basic temp)
  "co2+tvoc": {
    payloadType: "air_quality_v1",
    sensorType: "air_quality",
    models: ["AM319"],
    priority: 85,
    requiredFields: ["co2", "tvoc"],
  },
  "co2": {
    payloadType: "air_quality_v1",
    sensorType: "air_quality",
    models: ["AM103", "ERS-CO2"],
    priority: 80,
  },
  "tvoc": {
    payloadType: "air_quality_v1",
    sensorType: "air_quality",
    models: ["AM319"],
    priority: 80,
  },
  
  // GPS/Location
  "gps": {
    payloadType: "gps_v1",
    sensorType: "gps",
    models: ["TBS220"],
    priority: 85,
  },
  "latitude+longitude": {
    payloadType: "gps_v1",
    sensorType: "gps",
    models: ["LT-22222-L"],
    priority: 85,
    requiredFields: ["latitude", "longitude"],
  },
  
  // Metering/Pulse counting
  "pulse_count": {
    payloadType: "metering_v1",
    sensorType: "metering",
    models: ["KONA Pulse Counter"],
    priority: 75,
  },
  "counter": {
    payloadType: "metering_v1",
    sensorType: "metering",
    models: ["EM500-PP"],
    priority: 75,
  },
  
  // Temperature + Humidity combo (medium priority)
  "temperature+humidity": {
    payloadType: "temp_rh_v1",
    sensorType: "temperature",
    models: ["EM300-TH", "ERS"],
    priority: 60,
    requiredFields: ["temperature", "humidity"],
  },
  
  // Basic temperature (lowest priority - most common)
  "temperature": {
    payloadType: "temperature_v1",
    sensorType: "temperature",
    models: ["EM500-PT100"],
    priority: 40,
  },
};

/**
 * Multi-sensor detection patterns.
 * When multiple discriminator fields are present, classify as multi_sensor.
 */
const MULTI_SENSOR_PATTERNS = [
  {
    fields: ["temperature", "humidity", "door_status"],
    models: ["EM300-MCS"],
  },
];

// ============================================================================
// INFERENCE ENGINE
// ============================================================================

/**
 * Configuration options for inference.
 */
export interface InferenceOptions {
  /** Minimum confidence threshold to avoid 'unclassified' (default: 0.5) */
  minConfidence?: number;
  /** Skip ambiguity detection (default: false) */
  skipAmbiguityCheck?: boolean;
  /** Include detailed technical reasons (default: true) */
  includeDetails?: boolean;
}

/**
 * Create an inference reason object.
 */
function reason(
  rule: string,
  confidence: number,
  message: string,
  field?: string,
  value?: unknown
): InferenceReason {
  return { rule, confidence, message, field, value };
}

/**
 * Check if all required fields are present in payload.
 */
function hasAllFields(payload: Record<string, unknown>, fields: string[]): boolean {
  return fields.every(f => f in payload);
}

/**
 * Get all discriminator fields present in the payload.
 */
function getMatchingDiscriminators(
  payload: Record<string, unknown>
): Array<{ key: string; entry: DiscriminatorEntry }> {
  const payloadKeys = Object.keys(payload);
  const matches: Array<{ key: string; entry: DiscriminatorEntry }> = [];
  
  // Check combo discriminators first
  for (const [key, entry] of Object.entries(DISCRIMINATOR_MATRIX)) {
    if (entry.requiredFields) {
      if (hasAllFields(payload, entry.requiredFields)) {
        matches.push({ key, entry });
      }
    } else if (payloadKeys.includes(key)) {
      matches.push({ key, entry });
    }
  }
  
  // Sort by priority (highest first)
  return matches.sort((a, b) => b.entry.priority - a.entry.priority);
}

/**
 * Check for multi-sensor pattern match.
 */
function checkMultiSensorPattern(
  payload: Record<string, unknown>
): { matched: boolean; model: string | null } {
  for (const pattern of MULTI_SENSOR_PATTERNS) {
    if (hasAllFields(payload, pattern.fields)) {
      return { 
        matched: true, 
        model: pattern.models[0] || null 
      };
    }
  }
  return { matched: false, model: null };
}

/**
 * Infer the best matching model from discriminator matches.
 */
function inferModel(
  matches: Array<{ key: string; entry: DiscriminatorEntry }>,
  payload: Record<string, unknown>
): string | null {
  // Collect all possible models from matches
  const modelCandidates: Map<string, number> = new Map();
  
  for (const { entry } of matches) {
    for (const model of entry.models) {
      const current = modelCandidates.get(model) || 0;
      modelCandidates.set(model, current + entry.priority);
    }
  }
  
  // Return highest scoring model
  let bestModel: string | null = null;
  let bestScore = 0;
  
  for (const [model, score] of modelCandidates) {
    if (score > bestScore) {
      bestScore = score;
      bestModel = model;
    }
  }
  
  return bestModel;
}

/**
 * Calculate confidence score based on match quality.
 */
function calculateConfidence(
  matches: Array<{ key: string; entry: DiscriminatorEntry }>,
  payload: Record<string, unknown>
): number {
  if (matches.length === 0) return 0;
  
  const bestMatch = matches[0];
  const baseConfidence = bestMatch.entry.priority / 100;
  
  // Bonus for multiple matching discriminators
  const multiMatchBonus = Math.min(0.1, (matches.length - 1) * 0.02);
  
  // Penalty for ambiguous type matches
  const uniqueTypes = new Set(matches.map(m => m.entry.payloadType));
  const ambiguityPenalty = uniqueTypes.size > 1 ? 0.15 : 0;
  
  return Math.min(1, Math.max(0, baseConfidence + multiMatchBonus - ambiguityPenalty));
}

/**
 * Detect if the inference result is ambiguous.
 */
function detectAmbiguity(
  matches: Array<{ key: string; entry: DiscriminatorEntry }>
): { isAmbiguous: boolean; alternates: string[] } {
  if (matches.length <= 1) {
    return { isAmbiguous: false, alternates: [] };
  }
  
  const typesByPriority: Map<string, number> = new Map();
  
  for (const { entry } of matches) {
    const current = typesByPriority.get(entry.payloadType) || 0;
    typesByPriority.set(entry.payloadType, Math.max(current, entry.priority));
  }
  
  // Get top types
  const sortedTypes = [...typesByPriority.entries()]
    .sort((a, b) => b[1] - a[1]);
  
  if (sortedTypes.length < 2) {
    return { isAmbiguous: false, alternates: [] };
  }
  
  // If top two types are within 15 priority points, it's ambiguous
  const priorityDiff = sortedTypes[0][1] - sortedTypes[1][1];
  const isAmbiguous = priorityDiff <= 15;
  
  const alternates = isAmbiguous
    ? sortedTypes.slice(1).map(([type]) => type)
    : [];
  
  return { isAmbiguous, alternates };
}

/**
 * Main inference function.
 * 
 * Analyzes a decoded payload and returns a deterministic classification
 * with confidence scoring and explainable reasons.
 */
export function inferPayloadType(
  payload: Record<string, unknown> | null | undefined,
  options: InferenceOptions = {}
): InferenceResult {
  const {
    minConfidence = 0.5,
    skipAmbiguityCheck = false,
    includeDetails = true,
  } = options;
  
  const reasons: InferenceReason[] = [];
  
  // Handle null/invalid payload
  if (!payload || typeof payload !== "object") {
    return {
      payloadType: "unclassified",
      model: null,
      sensorType: "unknown",
      confidence: 0,
      reasons: [reason("invalid_payload", 0, "Payload is null or not an object")],
      isAmbiguous: false,
      alternates: [],
      schemaVersion: REGISTRY_VERSION,
    };
  }
  
  const payloadKeys = Object.keys(payload);
  
  // Handle empty payload
  if (payloadKeys.length === 0) {
    return {
      payloadType: "unclassified",
      model: null,
      sensorType: "unknown",
      confidence: 0,
      reasons: [reason("empty_payload", 0, "Payload has no fields")],
      isAmbiguous: false,
      alternates: [],
      schemaVersion: REGISTRY_VERSION,
    };
  }
  
  // Check for multi-sensor pattern first
  const multiSensor = checkMultiSensorPattern(payload);
  if (multiSensor.matched) {
    reasons.push(reason(
      "multi_sensor_pattern",
      0.95,
      "Payload matches multi-sensor pattern (temperature + humidity + door)",
      undefined,
      payloadKeys
    ));
    
    return {
      payloadType: "multi_sensor_v1",
      model: multiSensor.model,
      sensorType: "temperature", // Primary function
      confidence: 0.95,
      reasons,
      isAmbiguous: false,
      alternates: [],
      schemaVersion: REGISTRY_VERSION,
    };
  }
  
  // Get matching discriminators
  const matches = getMatchingDiscriminators(payload);
  
  // No matches - unclassified
  if (matches.length === 0) {
    reasons.push(reason(
      "no_discriminator_match",
      0,
      `No known discriminator fields found in payload. Fields: ${payloadKeys.join(", ")}`,
    ));
    
    return {
      payloadType: "unclassified",
      model: null,
      sensorType: "unknown",
      confidence: 0,
      reasons,
      isAmbiguous: false,
      alternates: [],
      schemaVersion: REGISTRY_VERSION,
    };
  }
  
  // Build reasons from matches
  for (const match of matches) {
    if (includeDetails) {
      reasons.push(reason(
        "discriminator_match",
        match.entry.priority / 100,
        `Field '${match.key}' indicates ${match.entry.payloadType} sensor`,
        match.key,
        payload[match.key]
      ));
    }
  }
  
  // Calculate confidence
  const confidence = calculateConfidence(matches, payload);
  
  // Detect ambiguity
  const { isAmbiguous, alternates } = skipAmbiguityCheck
    ? { isAmbiguous: false, alternates: [] }
    : detectAmbiguity(matches);
  
  if (isAmbiguous) {
    reasons.push(reason(
      "ambiguity_detected",
      -0.1,
      `Multiple types match with similar confidence: ${[matches[0].entry.payloadType, ...alternates].join(", ")}`,
    ));
  }
  
  // Get best match
  const bestMatch = matches[0];
  const model = inferModel(matches, payload);
  
  // Check confidence threshold
  if (confidence < minConfidence) {
    reasons.push(reason(
      "low_confidence",
      0,
      `Confidence ${(confidence * 100).toFixed(0)}% is below threshold ${(minConfidence * 100).toFixed(0)}%`,
    ));
    
    return {
      payloadType: "unclassified",
      model,
      sensorType: "unknown",
      confidence,
      reasons,
      isAmbiguous,
      alternates,
      schemaVersion: REGISTRY_VERSION,
    };
  }
  
  return {
    payloadType: bestMatch.entry.payloadType,
    model,
    sensorType: bestMatch.entry.sensorType,
    confidence,
    reasons,
    isAmbiguous,
    alternates,
    schemaVersion: REGISTRY_VERSION,
  };
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Legacy function - infer sensor type from payload.
 * @deprecated Use inferPayloadType() for full inference results.
 */
export function inferSensorTypeFromPayload(
  payload: Record<string, unknown> | null | undefined
): string | null {
  const result = inferPayloadType(payload);
  if (result.payloadType === "unclassified") return null;
  return result.sensorType;
}

/**
 * Legacy function - infer model from payload.
 * @deprecated Use inferPayloadType() for full inference results.
 */
export function inferModelFromPayload(
  payload: Record<string, unknown> | null | undefined
): string | null {
  const result = inferPayloadType(payload);
  return result.model;
}

// Re-export from payloadRegistry for compatibility
export { extractModelFromUnitId } from "./payloadRegistry.ts";
