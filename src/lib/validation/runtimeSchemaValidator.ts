/**
 * Runtime Schema Validator
 * 
 * Client-side validation to check payloads against expected schemas.
 * Used for diagnostics and determining widget health states.
 */

import type { DeviceCapability } from "@/lib/registry/capabilityRegistry";

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  /** Whether the payload is valid according to the schema */
  valid: boolean;
  /** Required fields that are missing from the payload */
  missingRequired: string[];
  /** Optional fields that are missing but expected */
  missingOptional: string[];
  /** Fields present in payload but not in schema */
  unexpectedFields: string[];
  /** Validation error messages */
  errors: string[];
  /** Warnings (non-blocking issues) */
  warnings: string[];
}

/**
 * Schema definition for payload types
 */
export interface PayloadSchema {
  payloadType: string;
  version: string;
  requiredFields: string[];
  optionalFields: string[];
  capabilities: DeviceCapability[];
}

/**
 * Registry of known payload schemas
 */
export const PAYLOAD_SCHEMAS: Record<string, PayloadSchema> = {
  temp_rh_v1: {
    payloadType: "temp_rh_v1",
    version: "1.0.0",
    requiredFields: ["temperature"],
    optionalFields: ["humidity", "battery_level", "signal_strength"],
    capabilities: ["temperature", "humidity", "battery"],
  },
  door_v1: {
    payloadType: "door_v1",
    version: "1.0.0",
    requiredFields: ["door_open"],
    optionalFields: ["battery_level", "signal_strength", "open_count", "open_duration_seconds"],
    capabilities: ["door", "battery"],
  },
  temperature_only_v1: {
    payloadType: "temperature_only_v1",
    version: "1.0.0",
    requiredFields: ["temperature"],
    optionalFields: ["battery_level", "signal_strength"],
    capabilities: ["temperature", "battery"],
  },
  air_quality_co2_v1: {
    payloadType: "air_quality_co2_v1",
    version: "1.0.0",
    requiredFields: ["co2"],
    optionalFields: ["temperature", "humidity", "battery_level", "signal_strength"],
    capabilities: ["co2", "temperature", "humidity", "battery"],
  },
  multi_door_temp_v1: {
    payloadType: "multi_door_temp_v1",
    version: "1.0.0",
    requiredFields: ["temperature", "door_open"],
    optionalFields: ["humidity", "battery_level", "signal_strength"],
    capabilities: ["temperature", "door", "battery"],
  },
  motion_v1: {
    payloadType: "motion_v1",
    version: "1.0.0",
    requiredFields: ["motion_detected"],
    optionalFields: ["battery_level", "signal_strength", "motion_count"],
    capabilities: ["motion", "battery"],
  },
  leak_v1: {
    payloadType: "leak_v1",
    version: "1.0.0",
    requiredFields: ["leak_detected"],
    optionalFields: ["battery_level", "signal_strength"],
    capabilities: ["leak", "battery"],
  },
  gps_v1: {
    payloadType: "gps_v1",
    version: "1.0.0",
    requiredFields: ["latitude", "longitude"],
    optionalFields: ["altitude", "speed", "heading", "battery_level", "signal_strength"],
    capabilities: ["gps", "battery"],
  },
  pulse_v1: {
    payloadType: "pulse_v1",
    version: "1.0.0",
    requiredFields: ["pulse_count"],
    optionalFields: ["battery_level", "signal_strength"],
    capabilities: ["pulse", "battery"],
  },
};

/**
 * Validate a payload against its expected schema
 */
export function validatePayloadSchema(
  payload: Record<string, unknown> | null,
  payloadType: string
): SchemaValidationResult {
  // Empty result for null payload
  if (!payload) {
    return {
      valid: false,
      missingRequired: [],
      missingOptional: [],
      unexpectedFields: [],
      errors: ["No payload data available"],
      warnings: [],
    };
  }

  const schema = PAYLOAD_SCHEMAS[payloadType];
  
  // Unknown schema type
  if (!schema) {
    return {
      valid: false,
      missingRequired: [],
      missingOptional: [],
      unexpectedFields: Object.keys(payload),
      errors: [`Unknown payload type: ${payloadType}`],
      warnings: [],
    };
  }

  const payloadKeys = Object.keys(payload);
  const allSchemaFields = [...schema.requiredFields, ...schema.optionalFields];
  
  // Check for missing required fields
  const missingRequired = schema.requiredFields.filter(
    field => !(field in payload) || payload[field] === null || payload[field] === undefined
  );
  
  // Check for missing optional fields
  const missingOptional = schema.optionalFields.filter(
    field => !(field in payload) || payload[field] === null || payload[field] === undefined
  );
  
  // Check for unexpected fields
  const unexpectedFields = payloadKeys.filter(
    key => !allSchemaFields.includes(key)
  );
  
  // Build errors and warnings
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (missingRequired.length > 0) {
    errors.push(`Missing required fields: ${missingRequired.join(", ")}`);
  }
  
  if (missingOptional.length > 0 && missingOptional.length === schema.optionalFields.length) {
    warnings.push(`All optional fields missing: ${missingOptional.join(", ")}`);
  }
  
  if (unexpectedFields.length > 0) {
    warnings.push(`Unexpected fields (ignored): ${unexpectedFields.join(", ")}`);
  }
  
  return {
    valid: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    unexpectedFields,
    errors,
    warnings,
  };
}

/**
 * Get schema for a payload type
 */
export function getPayloadSchema(payloadType: string): PayloadSchema | null {
  return PAYLOAD_SCHEMAS[payloadType] ?? null;
}

/**
 * Get all registered payload types
 */
export function getRegisteredPayloadTypes(): string[] {
  return Object.keys(PAYLOAD_SCHEMAS);
}

/**
 * Check if a payload type is registered
 */
export function isPayloadTypeRegistered(payloadType: string): boolean {
  return payloadType in PAYLOAD_SCHEMAS;
}

/**
 * Get capabilities for a payload type
 */
export function getPayloadCapabilities(payloadType: string): DeviceCapability[] {
  return PAYLOAD_SCHEMAS[payloadType]?.capabilities ?? [];
}

/**
 * Inference result with full reason chain (Epic 1 compliant)
 */
export interface InferenceResult {
  payloadType: string;
  confidence: number;
  matchedFields: string[];
  reasons: string[];
  isAmbiguous: boolean;
  alternates: Array<{ type: string; score: number }>;
}

/**
 * Detect payload type from a sample payload.
 * Returns "unclassified" (never null) for unknown/empty payloads per Epic 1 requirements.
 */
export function inferPayloadType(payload: Record<string, unknown> | null | undefined): InferenceResult {
  // Handle null/undefined/empty payloads - return "unclassified" per Epic 1
  if (!payload || Object.keys(payload).length === 0) {
    return {
      payloadType: "unclassified",
      confidence: 0,
      matchedFields: [],
      reasons: ["No payload data available", "Cannot classify empty or null payload"],
      isAmbiguous: false,
      alternates: [],
    };
  }

  const payloadKeys = Object.keys(payload);
  let bestMatch: string | null = null;
  let bestScore = 0;
  let bestMatchedFields: string[] = [];
  const candidates: Array<{ type: string; score: number; matchedFields: string[] }> = [];

  for (const [type, schema] of Object.entries(PAYLOAD_SCHEMAS)) {
    const requiredMatches = schema.requiredFields.filter(f => f in payload);
    const optionalMatches = schema.optionalFields.filter(f => f in payload);
    
    // Must match all required fields for a valid inference
    if (requiredMatches.length < schema.requiredFields.length) {
      continue;
    }
    
    // Score based on matched fields
    const matchedFields = [...requiredMatches, ...optionalMatches];
    const score = (requiredMatches.length * 2 + optionalMatches.length) / 
                  (schema.requiredFields.length * 2 + schema.optionalFields.length);
    
    candidates.push({ type, score, matchedFields });
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = type;
      bestMatchedFields = matchedFields;
    }
  }

  // No match found - return unclassified (never null per Epic 1)
  if (!bestMatch) {
    return {
      payloadType: "unclassified",
      confidence: 0,
      matchedFields: [],
      reasons: [
        "No schema matched the payload",
        `Payload fields: ${payloadKeys.join(", ")}`,
        "None of the registered schemas matched required fields",
      ],
      isAmbiguous: false,
      alternates: [],
    };
  }

  // Check for ambiguity - multiple schemas with similar scores
  const threshold = 0.1;
  const alternates = candidates
    .filter(c => c.type !== bestMatch && Math.abs(c.score - bestScore) < threshold)
    .map(c => ({ type: c.type, score: c.score }));

  const isAmbiguous = alternates.length > 0;

  const reasons: string[] = [
    `Matched schema: ${bestMatch}`,
    `Required fields matched: ${bestMatchedFields.filter(f => PAYLOAD_SCHEMAS[bestMatch!]?.requiredFields.includes(f)).join(", ")}`,
  ];

  if (isAmbiguous) {
    reasons.push(`Ambiguous: ${alternates.map(a => a.type).join(", ")} also matched with similar confidence`);
  }

  return {
    payloadType: bestMatch,
    confidence: bestScore,
    matchedFields: bestMatchedFields,
    reasons,
    isAmbiguous,
    alternates,
  };
}
