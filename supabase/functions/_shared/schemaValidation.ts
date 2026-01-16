/**
 * Schema Validation Utilities
 * 
 * Lightweight JSON Schema validation for payload type verification.
 * Uses native TypeScript validation instead of Ajv for Deno compatibility.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  schemaId: string;
  schemaVersion: string;
}

export interface SchemaMatch {
  name: string;
  valid: boolean;
  confidence: number;
  matchedFields: string[];
  missingFields: string[];
}

// ============================================================================
// FIELD TYPE VALIDATORS
// ============================================================================

type FieldValidator = (value: unknown) => boolean;

const typeValidators: Record<string, FieldValidator> = {
  string: (v) => typeof v === "string",
  number: (v) => typeof v === "number" && !isNaN(v),
  integer: (v) => typeof v === "number" && Number.isInteger(v),
  boolean: (v) => typeof v === "boolean",
  object: (v) => typeof v === "object" && v !== null && !Array.isArray(v),
  array: (v) => Array.isArray(v),
  null: (v) => v === null,
};

// ============================================================================
// PAYLOAD SCHEMAS
// ============================================================================

interface FieldSchema {
  type: string;
  required?: boolean;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
}

interface PayloadSchema {
  name: string;
  category: string;
  sensorType: string;
  models: string[];
  fields: Record<string, FieldSchema>;
  requiredFields: string[];
  discriminatorFields: string[];
}

/**
 * Payload schemas derived from sample files.
 * This is a compiled representation for runtime validation.
 */
const PAYLOAD_SCHEMAS: PayloadSchema[] = [
  // Door sensors
  {
    name: "door_lds02",
    category: "door",
    sensorType: "door",
    models: ["LDS02"],
    fields: {
      door_status: { type: "string", enum: ["open", "closed"] },
      battery_level: { type: "integer", minimum: 0, maximum: 100 },
    },
    requiredFields: ["door_status"],
    discriminatorFields: ["door_status"],
  },
  {
    name: "door_r311a",
    category: "door",
    sensorType: "door",
    models: ["R311A"],
    fields: {
      door: { type: "boolean" },
      battery_voltage: { type: "number", minimum: 0, maximum: 4.5 },
    },
    requiredFields: ["door"],
    discriminatorFields: ["door"],
  },
  {
    name: "door_ds3604",
    category: "door",
    sensorType: "door",
    models: ["DS3604"],
    fields: {
      open_close: { type: "integer", enum: [0, 1] },
      battery_level: { type: "integer", minimum: 0, maximum: 100 },
    },
    requiredFields: ["open_close"],
    discriminatorFields: ["open_close"],
  },
  
  // Temperature sensors
  {
    name: "temperature_humidity",
    category: "temperature_humidity",
    sensorType: "temperature",
    models: ["EM300-TH", "ERS"],
    fields: {
      temperature: { type: "number" },
      humidity: { type: "number", minimum: 0, maximum: 100 },
      battery_level: { type: "integer", minimum: 0, maximum: 100 },
    },
    requiredFields: ["temperature", "humidity"],
    discriminatorFields: ["temperature", "humidity"],
  },
  {
    name: "temperature_only",
    category: "temperature",
    sensorType: "temperature",
    models: ["EM500-PT100"],
    fields: {
      temperature: { type: "number" },
    },
    requiredFields: ["temperature"],
    discriminatorFields: ["temperature"],
  },
  
  // Air quality sensors
  {
    name: "air_quality_co2_tvoc",
    category: "air_quality",
    sensorType: "air_quality",
    models: ["AM319"],
    fields: {
      temperature: { type: "number" },
      humidity: { type: "number", minimum: 0, maximum: 100 },
      co2: { type: "integer", minimum: 0, maximum: 10000 },
      tvoc: { type: "integer", minimum: 0, maximum: 60000 },
    },
    requiredFields: ["co2", "tvoc"],
    discriminatorFields: ["co2", "tvoc"],
  },
  {
    name: "air_quality_co2",
    category: "air_quality",
    sensorType: "air_quality",
    models: ["AM103", "ERS-CO2"],
    fields: {
      temperature: { type: "number" },
      humidity: { type: "number", minimum: 0, maximum: 100 },
      co2: { type: "integer", minimum: 0, maximum: 10000 },
    },
    requiredFields: ["co2"],
    discriminatorFields: ["co2"],
  },
  
  // Leak sensors
  {
    name: "leak_water",
    category: "leak",
    sensorType: "leak",
    models: ["LDDS75"],
    fields: {
      water_leak: { type: "boolean" },
      battery_level: { type: "integer", minimum: 0, maximum: 100 },
    },
    requiredFields: ["water_leak"],
    discriminatorFields: ["water_leak"],
  },
  {
    name: "leak_generic",
    category: "leak",
    sensorType: "leak",
    models: ["R718WA2"],
    fields: {
      leak: { type: "boolean" },
      battery_voltage: { type: "number", minimum: 0, maximum: 4.5 },
    },
    requiredFields: ["leak"],
    discriminatorFields: ["leak"],
  },
  
  // Motion sensors
  {
    name: "motion",
    category: "motion",
    sensorType: "motion",
    models: ["TBMS100"],
    fields: {
      motion: { type: "boolean" },
      battery_level: { type: "integer", minimum: 0, maximum: 100 },
    },
    requiredFields: ["motion"],
    discriminatorFields: ["motion"],
  },
  
  // GPS sensors
  {
    name: "gps_latlon",
    category: "gps",
    sensorType: "gps",
    models: ["LT-22222-L"],
    fields: {
      latitude: { type: "number", minimum: -90, maximum: 90 },
      longitude: { type: "number", minimum: -180, maximum: 180 },
      battery_level: { type: "integer", minimum: 0, maximum: 100 },
    },
    requiredFields: ["latitude", "longitude"],
    discriminatorFields: ["latitude", "longitude"],
  },
  {
    name: "gps_nested",
    category: "gps",
    sensorType: "gps",
    models: ["TBS220"],
    fields: {
      gps: { type: "object" },
      battery_level: { type: "integer", minimum: 0, maximum: 100 },
    },
    requiredFields: ["gps"],
    discriminatorFields: ["gps"],
  },
  
  // Metering sensors
  {
    name: "metering_counter",
    category: "metering",
    sensorType: "metering",
    models: ["EM500-PP"],
    fields: {
      counter: { type: "integer", minimum: 0 },
      battery_level: { type: "integer", minimum: 0, maximum: 100 },
    },
    requiredFields: ["counter"],
    discriminatorFields: ["counter"],
  },
  {
    name: "metering_pulse",
    category: "metering",
    sensorType: "metering",
    models: ["KONA Pulse Counter"],
    fields: {
      pulse_count: { type: "integer", minimum: 0 },
      total_count: { type: "integer", minimum: 0 },
    },
    requiredFields: ["pulse_count"],
    discriminatorFields: ["pulse_count", "total_count"],
  },
  
  // Multi-sensor
  {
    name: "multi_sensor_temp_door",
    category: "multi_sensor",
    sensorType: "temperature",
    models: ["EM300-MCS"],
    fields: {
      temperature: { type: "number" },
      humidity: { type: "number", minimum: 0, maximum: 100 },
      door_status: { type: "string", enum: ["open", "closed"] },
      battery_level: { type: "integer", minimum: 0, maximum: 100 },
    },
    requiredFields: ["temperature", "humidity", "door_status"],
    discriminatorFields: ["temperature", "humidity", "door_status"],
  },
];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a single field value against its schema.
 */
function validateField(
  value: unknown,
  schema: FieldSchema,
  path: string
): ValidationError | null {
  // Type validation
  const typeValidator = typeValidators[schema.type];
  if (typeValidator && !typeValidator(value)) {
    return {
      path,
      message: `Expected ${schema.type}, got ${typeof value}`,
      value,
    };
  }
  
  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    return {
      path,
      message: `Value must be one of: ${schema.enum.join(", ")}`,
      value,
    };
  }
  
  // Range validation
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      return {
        path,
        message: `Value must be >= ${schema.minimum}`,
        value,
      };
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      return {
        path,
        message: `Value must be <= ${schema.maximum}`,
        value,
      };
    }
  }
  
  return null;
}

/**
 * Validate a payload against a specific schema.
 */
export function validatePayloadAgainstSchema(
  payload: Record<string, unknown>,
  schema: PayloadSchema
): ValidationResult {
  const errors: ValidationError[] = [];
  
  // Check required fields
  for (const field of schema.requiredFields) {
    if (!(field in payload)) {
      errors.push({
        path: field,
        message: `Missing required field: ${field}`,
      });
    }
  }
  
  // Validate present fields
  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    if (fieldName in payload) {
      const error = validateField(payload[fieldName], fieldSchema, fieldName);
      if (error) {
        errors.push(error);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    schemaId: schema.name,
    schemaVersion: "1.0.0",
  };
}

/**
 * Find all schemas that match a payload.
 */
export function findMatchingSchemas(
  payload: Record<string, unknown>
): SchemaMatch[] {
  const payloadKeys = Object.keys(payload);
  const matches: SchemaMatch[] = [];
  
  for (const schema of PAYLOAD_SCHEMAS) {
    // Check if discriminator fields are present
    const hasDiscriminators = schema.discriminatorFields.every(
      field => field in payload
    );
    
    if (!hasDiscriminators) continue;
    
    // Validate against schema
    const result = validatePayloadAgainstSchema(payload, schema);
    
    if (result.valid) {
      // Calculate match quality
      const matchedFields = Object.keys(schema.fields).filter(
        f => f in payload
      );
      const missingFields = schema.requiredFields.filter(
        f => !(f in payload)
      );
      
      // Confidence based on how many schema fields are present
      const schemaFieldCount = Object.keys(schema.fields).length;
      const matchedFieldCount = matchedFields.length;
      const confidence = schemaFieldCount > 0 
        ? matchedFieldCount / schemaFieldCount 
        : 0;
      
      matches.push({
        name: schema.name,
        valid: true,
        confidence,
        matchedFields,
        missingFields,
      });
    }
  }
  
  // Sort by confidence (highest first)
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get the best matching schema for a payload.
 */
export function getBestMatchingSchema(
  payload: Record<string, unknown>
): { schema: PayloadSchema | null; match: SchemaMatch | null } {
  const matches = findMatchingSchemas(payload);
  
  if (matches.length === 0) {
    return { schema: null, match: null };
  }
  
  const bestMatch = matches[0];
  const schema = PAYLOAD_SCHEMAS.find(s => s.name === bestMatch.name) || null;
  
  return { schema, match: bestMatch };
}

/**
 * Get all available payload schemas.
 */
export function getAllSchemas(): PayloadSchema[] {
  return [...PAYLOAD_SCHEMAS];
}

/**
 * Get schemas for a specific category.
 */
export function getSchemasByCategory(category: string): PayloadSchema[] {
  return PAYLOAD_SCHEMAS.filter(s => s.category === category);
}

/**
 * Get schema by name.
 */
export function getSchemaByName(name: string): PayloadSchema | undefined {
  return PAYLOAD_SCHEMAS.find(s => s.name === name);
}
