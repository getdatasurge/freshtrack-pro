/**
 * Payload Registry
 * 
 * Provides functions to infer sensor type and model from decoded payload data.
 * This is the most reliable inference method since real sensors always produce
 * characteristic payload patterns.
 * 
 * NOTE: For full inference with confidence scoring and explainable reasons,
 * use the new payloadInference.ts module instead.
 */

import { knownSamples } from "./internalSampleDB.ts";

// Re-export new inference engine for gradual migration
export { 
  inferPayloadType,
  REGISTRY_VERSION,
  type InferenceOptions,
} from "./payloadInference.ts";

export type { 
  InferenceResult, 
  InferenceReason 
} from "./eventTypes.ts";

/**
 * Maps decoded payload field names to sensor types.
 * Priority is determined by the order in PRIORITY_FIELDS array.
 */
const FIELD_TYPE_MAP: Record<string, string> = {
  // Door/Contact sensors (highest priority - very distinctive)
  door_status: "door",
  door_open: "door",
  door: "door",
  open_close: "door",
  contact: "door",
  
  // Leak detection (high priority - safety critical)
  water_leak: "leak",
  leak: "leak",
  flood: "leak",
  water_detected: "leak",
  
  // Motion sensors
  motion: "motion",
  occupancy: "motion",
  pir: "motion",
  movement: "motion",
  
  // Air quality (before basic temperature)
  co2: "air_quality",
  tvoc: "air_quality",
  pm25: "air_quality",
  pm10: "air_quality",
  voc: "air_quality",
  
  // GPS/Location
  gps: "gps",
  latitude: "gps",
  longitude: "gps",
  location: "gps",
  
  // Metering/Pulse counting
  pulse_count: "metering",
  total_count: "metering",
  counter: "metering",
  pulses: "metering",
  
  // Temperature + Humidity (combo type)
  humidity: "temperature_humidity",
  relative_humidity: "temperature_humidity",
  rh: "temperature_humidity",
  
  // Basic temperature (lowest priority - most common)
  temperature: "temperature",
  temp: "temperature",
};

/**
 * Priority order for field matching.
 * More specific/distinctive fields come first.
 */
const PRIORITY_FIELDS = [
  // Door sensors - very distinctive
  "door_status", "door_open", "door", "open_close", "contact",
  // Leak detection - safety critical
  "water_leak", "leak", "flood", "water_detected",
  // Motion
  "motion", "occupancy", "pir", "movement",
  // Air quality
  "co2", "tvoc", "pm25", "pm10", "voc",
  // GPS
  "gps", "latitude", "longitude", "location",
  // Metering
  "pulse_count", "total_count", "counter", "pulses",
  // Humidity (upgrades temp to temp_humidity)
  "humidity", "relative_humidity", "rh",
  // Temperature (most common, lowest priority)
  "temperature", "temp"
];

/**
 * Infer sensor type from decoded payload field keys.
 * Uses priority ordering to handle multi-field payloads correctly.
 * 
 * @param payload - The decoded payload from the sensor
 * @returns The inferred sensor type or null if unknown
 */
export function inferSensorTypeFromPayload(
  payload: Record<string, unknown> | null | undefined
): string | null {
  if (!payload || typeof payload !== 'object') return null;
  
  const payloadKeys = Object.keys(payload);
  if (payloadKeys.length === 0) return null;
  
  // Check fields in priority order
  for (const field of PRIORITY_FIELDS) {
    if (field in payload && FIELD_TYPE_MAP[field]) {
      return FIELD_TYPE_MAP[field];
    }
  }
  
  // Fallback: check any field that matches our map
  for (const key of payloadKeys) {
    const lowerKey = key.toLowerCase();
    if (FIELD_TYPE_MAP[lowerKey]) {
      return FIELD_TYPE_MAP[lowerKey];
    }
  }
  
  return null;
}

/**
 * Infer device model from decoded payload structure.
 * Matches payload against known sample structures.
 * 
 * @param payload - The decoded payload from the sensor
 * @returns The inferred model name or null if no match
 */
export function inferModelFromPayload(
  payload: Record<string, unknown> | null | undefined
): string | null {
  if (!payload || typeof payload !== 'object') return null;
  
  const payloadKeys = Object.keys(payload);
  if (payloadKeys.length === 0) return null;
  
  let bestMatch: string | null = null;
  let bestScore = 0;
  
  for (const [model, sample] of Object.entries(knownSamples)) {
    const sampleKeys = Object.keys(sample.decoded_payload);
    
    // Count how many sample keys are present in the payload
    const matchedKeys = sampleKeys.filter(k => k in payload);
    
    // Calculate match score (percentage of sample keys found)
    const score = matchedKeys.length / sampleKeys.length;
    
    // Require at least 50% match and prefer higher scores
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = model;
    }
  }
  
  return bestMatch;
}

/**
 * Known model prefixes that might appear in unit names.
 * Sorted by length (longest first) to match most specific first.
 */
const MODEL_PREFIXES = [
  // Multi-part models (longest first)
  "EM300-MCS", "EM300-TH", "EM310-UDL",
  "EM500-PT100", "EM500-SMTC", "EM500-SWL", "EM500-UDL", "EM500-PP",
  "ERS-CO2",
  "LT-22222-L",
  "R718WA2",
  // Shorter models
  "TBMS100",
  "AM103L", "AM104L", "AM107L",
  "AM103", "AM104", "AM107", "AM308", "AM319",
  "LDDS75",
  "LDS02", "LDS03",
  "DS3604",
  "WS101", "WS156", "WS301", "WS302", "WS303",
  "TBS220",
  "R311A", "R311W",
  "EM300", "EM500", "EM310",
  "ERS",
].sort((a, b) => b.length - a.length);

/**
 * Extract device model from unit ID or unit name.
 * Uses known model prefixes and naming patterns.
 * 
 * @param unitId - The unit ID or unit name string
 * @returns The extracted model name or null if not found
 * 
 * @example
 * extractModelFromUnitId("LDS02 Kitchen") // returns "LDS02"
 * extractModelFromUnitId("EM300-TH 1") // returns "EM300-TH"
 * extractModelFromUnitId("Fridge Sensor") // returns null
 */
export function extractModelFromUnitId(
  unitId: string | null | undefined
): string | null {
  if (!unitId || typeof unitId !== 'string') return null;
  
  const normalized = unitId.trim().toUpperCase();
  if (normalized.length < 3) return null;
  
  // Try to find known model prefix in unit name
  for (const prefix of MODEL_PREFIXES) {
    if (normalized.includes(prefix.toUpperCase())) {
      return prefix;
    }
  }
  
  // Try pattern: "MODEL_NAME 1" or "MODEL_NAME-1" or "MODEL_NAME_1"
  // Extract the first alphanumeric-dash segment
  const match = normalized.match(/^([A-Z][A-Z0-9-]+?)[\s_\-]?\d*$/);
  if (match && match[1].length >= 4) {
    // Check if it looks like a model (has numbers or dashes)
    if (/[0-9]/.test(match[1]) || match[1].includes('-')) {
      return match[1];
    }
  }
  
  return null;
}
