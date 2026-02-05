/**
 * Server-side Device Registry
 *
 * Lightweight model→category→sensor_type mapping for edge functions.
 * Mirrors the frontend DEVICE_REGISTRY but without UI dependencies.
 *
 * Also includes sensor native unit metadata for temperature sensors,
 * which is critical for unit-correct alarm evaluation.
 */

import type { TemperatureUnit } from "./unitConversion.ts";
import { DEFAULT_SENSOR_NATIVE_UNIT } from "./unitConversion.ts";

// Model → Category mapping (mirrors frontend src/lib/devices/deviceRegistry.ts)
export const MODEL_TO_CATEGORY: Record<string, string> = {
  // Motion sensors
  "TBMS100": "motion",
  
  // Temperature sensors
  "EM300-TH": "temperature",
  "ERS": "temperature",
  "ERS-CO2": "temperature", // Also has CO2 but primary is temp
  "EM500-PP": "temperature",
  "EM500-PT100": "temperature",
  "EM500-SMTC": "temperature",
  "EM500-SWL": "temperature",
  "EM500-UDL": "temperature",
  "WS301": "temperature",
  "WS302": "temperature",
  "WS303": "temperature",
  
  // Temperature + Humidity combo
  "AM103": "temperature", // Multi-sensor but primary is temp
  "AM104": "temperature",
  "AM107": "temperature",
  "AM308": "temperature",
  
  // Leak Detection
  "LDDS75": "leak",
  "R718WA2": "leak",
  "EM500-SWL-L050": "leak",
  
  // Metering / Pulse Counter
  "KONA Pulse Counter": "metering",
  "EM500-PP-L050": "metering",
  
  // Door / Contact sensors
  "LDS02": "door",
  "R311A": "door",
  "DS3604": "door",
  "WS101": "door",
  "WS156": "door",
  
  // GPS / Location
  "LT-22222-L": "gps",
  "TBS220": "gps",
  
  // Air Quality
  "AM319": "air_quality",
  "ERS CO2": "air_quality",
  "AM103L": "air_quality",
  "AM104L": "air_quality",
  "AM107L": "air_quality",
  
  // Multi-Sensor
  "EM300-MCS": "multi_sensor",
  "EM300-MCS-L050": "multi_sensor",
  "EM310-UDL": "multi_sensor",
};

// Category → sensor_type enum mapping
// Maps device categories to the lora_sensor_type database enum
export const CATEGORY_TO_SENSOR_TYPE: Record<string, string> = {
  motion: "motion",
  temperature: "temperature",
  leak: "leak",
  metering: "metering",
  door: "door",
  gps: "gps",
  air_quality: "air_quality",
  multi_sensor: "multi_sensor",
  // Fallback categories that map to existing enum values
  combo: "combo",
  contact: "contact",
  temperature_humidity: "temperature_humidity",
};

/**
 * Get device category from model name
 * @param model - The device model string (e.g., "EM300-TH")
 * @returns Category string or null if unknown
 */
export function getDeviceCategory(model: string | null | undefined): string | null {
  if (!model) return null;
  
  // Try exact match first
  if (MODEL_TO_CATEGORY[model]) {
    return MODEL_TO_CATEGORY[model];
  }
  
  // Try case-insensitive match
  const modelUpper = model.toUpperCase();
  for (const [key, category] of Object.entries(MODEL_TO_CATEGORY)) {
    if (key.toUpperCase() === modelUpper) {
      return category;
    }
  }
  
  // Try partial match (e.g., "EM300-TH-868" should match "EM300-TH")
  for (const [key, category] of Object.entries(MODEL_TO_CATEGORY)) {
    if (model.startsWith(key) || model.includes(key)) {
      return category;
    }
  }
  
  return null;
}

/**
 * Infer sensor_type enum value from model name
 * @param model - The device model string
 * @returns sensor_type enum value or null if cannot be inferred
 */
export function inferSensorTypeFromModel(model: string | null | undefined): string | null {
  const category = getDeviceCategory(model);
  if (!category) return null;
  
  return CATEGORY_TO_SENSOR_TYPE[category] ?? null;
}

/**
 * Check if a model is known in the registry
 * @param model - The device model string
 * @returns true if model is recognized
 */
export function isKnownModel(model: string | null | undefined): boolean {
  return getDeviceCategory(model) !== null;
}

// ============================================================================
// Sensor Native Temperature Unit Registry
// ============================================================================

/**
 * Native temperature unit for each sensor model.
 *
 * Most LoRaWAN sensors report temperature in Celsius (°C).
 * Only models that explicitly report in Fahrenheit are listed as 'F'.
 *
 * This is used during ingestion to convert sensor readings to the
 * canonical storage unit (Fahrenheit).
 */
export const MODEL_NATIVE_TEMP_UNIT: Record<string, TemperatureUnit> = {
  // Milesight sensors - all report in Celsius
  "EM300-TH": "C",
  "EM300-MCS": "C",
  "EM300-MCS-L050": "C",
  "EM500-PP": "C",
  "EM500-PT100": "C",
  "EM500-SMTC": "C",
  "EM500-SWL": "C",
  "EM500-UDL": "C",
  "EM310-UDL": "C",
  "AM103": "C",
  "AM104": "C",
  "AM107": "C",
  "AM308": "C",
  "AM319": "C",
  "AM103L": "C",
  "AM104L": "C",
  "AM107L": "C",
  "WS301": "C",
  "WS302": "C",
  "WS303": "C",

  // Elsys sensors - report in Celsius
  "ERS": "C",
  "ERS-CO2": "C",
  "ERS CO2": "C",

  // Dragino sensors - report in Celsius (TempC_SHT, TempC_DS fields)
  "LHT65": "C",
  "LHT65N": "C",
  "LHT52": "C",
  "LDDS75": "C",
  "LDS02": "C",
  "LT-22222-L": "C",
  "LSN50v2": "C",
  "LSN50v2-D23": "C",

  // Netvox sensors - report in Celsius
  "R718WA2": "C",
  "R311A": "C",

  // Other sensors - report in Celsius
  "DS3604": "C",
  "WS101": "C",
  "WS156": "C",
  "TBS220": "C",
  "TBMS100": "C",
  "KONA Pulse Counter": "C",
};

/**
 * Telemetry field to measurement type mapping.
 * Used to identify which fields need unit conversion.
 */
export type MeasurementType = "temperature" | "humidity" | "pressure" | "co2" | "voc" | "distance";

export const FIELD_MEASUREMENT_TYPE: Record<string, MeasurementType> = {
  temperature: "temperature",
  temp: "temperature",
  TempC_SHT: "temperature",
  TempC_DS: "temperature",
  temperature_c: "temperature",
  temp_c: "temperature",
  humidity: "humidity",
  Hum_SHT: "humidity",
  humidity_pct: "humidity",
  relative_humidity: "humidity",
  co2: "co2",
  CO2: "co2",
  voc: "voc",
  VOC: "voc",
  distance: "distance",
  Distance: "distance",
};

/**
 * Get the native temperature unit for a sensor model.
 *
 * @param model - The device model string (e.g., "EM300-TH")
 * @returns The native temperature unit ('C' or 'F'), defaults to 'C' for unknown models
 *
 * @example
 * getSensorNativeUnit("EM300-TH") // Returns 'C'
 * getSensorNativeUnit("UNKNOWN-MODEL") // Returns 'C' (default)
 */
export function getSensorNativeUnit(model: string | null | undefined): TemperatureUnit {
  if (!model) {
    console.warn("[deviceRegistry] No model provided, using default native unit:", DEFAULT_SENSOR_NATIVE_UNIT);
    return DEFAULT_SENSOR_NATIVE_UNIT;
  }

  // Try exact match first
  if (MODEL_NATIVE_TEMP_UNIT[model]) {
    return MODEL_NATIVE_TEMP_UNIT[model];
  }

  // Try case-insensitive match
  const modelUpper = model.toUpperCase();
  for (const [key, unit] of Object.entries(MODEL_NATIVE_TEMP_UNIT)) {
    if (key.toUpperCase() === modelUpper) {
      return unit;
    }
  }

  // Try partial match (e.g., "EM300-TH-868" should match "EM300-TH")
  for (const [key, unit] of Object.entries(MODEL_NATIVE_TEMP_UNIT)) {
    if (model.startsWith(key) || model.includes(key)) {
      return unit;
    }
  }

  // Unknown model - log warning and return default
  console.warn(
    `[deviceRegistry] Unknown model "${model}", assuming native temp unit: ${DEFAULT_SENSOR_NATIVE_UNIT}. ` +
    "Consider adding this model to MODEL_NATIVE_TEMP_UNIT registry."
  );
  return DEFAULT_SENSOR_NATIVE_UNIT;
}

/**
 * Check if a sensor model reports temperature.
 *
 * @param model - The device model string
 * @returns true if the model is known to report temperature
 */
export function sensorReportsTemperature(model: string | null | undefined): boolean {
  const category = getDeviceCategory(model);
  if (!category) return false;

  // Categories that typically report temperature
  const tempCategories = ["temperature", "air_quality", "multi_sensor"];
  return tempCategories.includes(category);
}

/**
 * Get measurement info for a telemetry field.
 *
 * @param fieldName - The telemetry field name
 * @returns Measurement type or null if not a recognized measurement field
 */
export function getFieldMeasurementType(fieldName: string): MeasurementType | null {
  return FIELD_MEASUREMENT_TYPE[fieldName] ?? null;
}
