/**
 * Server-side Device Registry
 * 
 * Lightweight model→category→sensor_type mapping for edge functions.
 * Mirrors the frontend DEVICE_REGISTRY but without UI dependencies.
 */

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
