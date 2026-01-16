/**
 * Sensor Binding Types and Utilities
 * 
 * Manages the persistent binding between sensors and their inferred payload types.
 * Bindings are stored in lora_sensors.payload_binding JSONB column.
 */

import type { InferenceResult } from "./eventTypes.ts";

// ============================================================================
// BINDING TYPES
// ============================================================================

/**
 * Binding status enum.
 */
export type BindingStatus = 
  | "active"           // Binding is confirmed and in use
  | "review_required"  // Ambiguous inference, needs manual review
  | "overridden"       // Manually set by user, ignore auto-inference
  | "pending";         // Initial state, no inference yet

/**
 * Source of the binding.
 */
export type BindingSource = 
  | "auto"   // Automatically inferred
  | "manual" // Manually set by user
  | "import" // Imported from external source
  | "migration"; // Set during migration

/**
 * Persistent payload binding stored in sensor record.
 */
export interface PayloadBinding {
  /** Inferred payload type (e.g., "door", "temperature") */
  payloadType: string;
  
  /** Inferred device model (e.g., "LDS02") */
  model: string | null;
  
  /** Mapped sensor type (enum value) */
  sensorType: string;
  
  /** Confidence at binding time (0-1) */
  confidence: number;
  
  /** ISO timestamp when binding was created */
  boundAt: string;
  
  /** How the binding was created */
  source: BindingSource;
  
  /** Registry version used for inference */
  schemaVersion: string;
  
  /** Current status of the binding */
  status: BindingStatus;
  
  /** Last time this binding was validated against actual data */
  lastValidatedAt?: string;
  
  /** Number of payloads that matched this binding */
  matchCount?: number;
  
  /** Number of payloads that didn't match this binding */
  mismatchCount?: number;
  
  /** Notes/reason for manual override */
  notes?: string;
}

// ============================================================================
// BINDING UTILITIES
// ============================================================================

/**
 * Minimum confidence required for auto-binding.
 */
export const AUTO_BIND_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Confidence threshold below which binding goes to review.
 */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Create a new binding from an inference result.
 */
export function createBindingFromInference(
  inference: InferenceResult,
  source: BindingSource = "auto"
): PayloadBinding {
  const now = new Date().toISOString();
  
  // Determine status based on confidence and ambiguity
  let status: BindingStatus;
  if (inference.isAmbiguous) {
    status = "review_required";
  } else if (inference.confidence >= AUTO_BIND_CONFIDENCE_THRESHOLD) {
    status = "active";
  } else if (inference.confidence >= REVIEW_CONFIDENCE_THRESHOLD) {
    status = "review_required";
  } else {
    status = "pending";
  }
  
  return {
    payloadType: inference.payloadType,
    model: inference.model,
    sensorType: inference.sensorType,
    confidence: inference.confidence,
    boundAt: now,
    source,
    schemaVersion: inference.schemaVersion,
    status,
    lastValidatedAt: now,
    matchCount: 1,
    mismatchCount: 0,
  };
}

/**
 * Create a manual binding override.
 */
export function createManualBinding(
  payloadType: string,
  sensorType: string,
  model: string | null,
  schemaVersion: string,
  notes?: string
): PayloadBinding {
  const now = new Date().toISOString();
  
  return {
    payloadType,
    model,
    sensorType,
    confidence: 1.0, // Manual = 100% confidence
    boundAt: now,
    source: "manual",
    schemaVersion,
    status: "overridden",
    lastValidatedAt: now,
    matchCount: 0,
    mismatchCount: 0,
    notes,
  };
}

/**
 * Check if a binding should be updated based on new inference.
 */
export function shouldUpdateBinding(
  existing: PayloadBinding | null,
  newInference: InferenceResult
): { shouldUpdate: boolean; reason: string } {
  // No existing binding - always update
  if (!existing) {
    return { shouldUpdate: true, reason: "no_existing_binding" };
  }
  
  // Manual override - never update automatically
  if (existing.source === "manual" || existing.status === "overridden") {
    return { shouldUpdate: false, reason: "manual_override" };
  }
  
  // Same type - just validate
  if (existing.payloadType === newInference.payloadType) {
    return { shouldUpdate: false, reason: "type_matches" };
  }
  
  // Different type with higher confidence - update
  if (newInference.confidence > existing.confidence + 0.1) {
    return { 
      shouldUpdate: true, 
      reason: `higher_confidence: ${newInference.confidence} > ${existing.confidence}` 
    };
  }
  
  // Different type with lower confidence - flag for review
  if (newInference.payloadType !== existing.payloadType) {
    return { 
      shouldUpdate: false, 
      reason: "type_mismatch_needs_review" 
    };
  }
  
  return { shouldUpdate: false, reason: "no_update_needed" };
}

/**
 * Update binding validation stats after processing a payload.
 */
export function updateBindingStats(
  binding: PayloadBinding,
  matched: boolean
): PayloadBinding {
  return {
    ...binding,
    lastValidatedAt: new Date().toISOString(),
    matchCount: (binding.matchCount || 0) + (matched ? 1 : 0),
    mismatchCount: (binding.mismatchCount || 0) + (matched ? 0 : 1),
  };
}

/**
 * Check if a binding has reliability issues.
 */
export function hasReliabilityIssues(binding: PayloadBinding): boolean {
  const total = (binding.matchCount || 0) + (binding.mismatchCount || 0);
  if (total < 5) return false; // Not enough data
  
  const mismatchRate = (binding.mismatchCount || 0) / total;
  return mismatchRate > 0.1; // More than 10% mismatches
}

/**
 * Serialize binding for database storage.
 */
export function serializeBinding(binding: PayloadBinding): string {
  return JSON.stringify(binding);
}

/**
 * Parse binding from database storage.
 */
export function parseBinding(json: string | Record<string, unknown> | null): PayloadBinding | null {
  if (!json) return null;
  
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    
    // Validate required fields
    if (!data.payloadType || !data.sensorType || !data.schemaVersion) {
      return null;
    }
    
    return data as PayloadBinding;
  } catch {
    return null;
  }
}
