/**
 * Payload Inference Test Suite
 * 
 * Ensures 100% of samples are classified correctly,
 * detects ambiguity, and prevents schema drift.
 */

import { assertEquals, assertNotEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { inferPayloadType, REGISTRY_VERSION } from "./payloadInference.ts";

// ============================================================================
// SAMPLE DATA (mirroring JSON sample files)
// ============================================================================

interface SampleDefinition {
  model: string;
  category: string;
  sensorType: string;
  samples: Array<{
    description: string;
    decoded_payload: Record<string, unknown>;
  }>;
}

const ALL_SAMPLES: SampleDefinition[] = [
  // Door sensors
  {
    model: "LDS02",
    category: "door",
    sensorType: "door",
    samples: [
      { description: "Door closed", decoded_payload: { door_status: "closed", battery_level: 90 } },
      { description: "Door open", decoded_payload: { door_status: "open", battery_level: 85 } },
    ],
  },
  {
    model: "R311A",
    category: "door",
    sensorType: "door",
    samples: [
      { description: "Door open (true)", decoded_payload: { door: true, battery_voltage: 3.0 } },
      { description: "Door closed (false)", decoded_payload: { door: false, battery_voltage: 2.8 } },
    ],
  },
  {
    model: "DS3604",
    category: "door",
    sensorType: "door",
    samples: [
      { description: "Door closed (0)", decoded_payload: { open_close: 0, battery_level: 95 } },
      { description: "Door open (1)", decoded_payload: { open_close: 1, battery_level: 90 } },
    ],
  },
  
  // Temperature sensors
  {
    model: "EM300-TH",
    category: "temperature_humidity",
    sensorType: "temperature",
    samples: [
      { description: "Normal conditions", decoded_payload: { temperature: 22.1, humidity: 45.3, battery_level: 95 } },
      { description: "Cold conditions", decoded_payload: { temperature: -18.5, humidity: 30.0, battery_level: 88 } },
    ],
  },
  {
    model: "EM500-PT100",
    category: "temperature",
    sensorType: "temperature",
    samples: [
      { description: "Room temperature", decoded_payload: { temperature: 25.0 } },
      { description: "Hot environment", decoded_payload: { temperature: 85.5 } },
    ],
  },
  
  // Air quality sensors
  {
    model: "AM319",
    category: "air_quality",
    sensorType: "air_quality",
    samples: [
      { description: "Good air quality", decoded_payload: { temperature: 23.5, humidity: 50, co2: 450, tvoc: 120 } },
      { description: "Poor air quality", decoded_payload: { temperature: 24.0, humidity: 55, co2: 1200, tvoc: 350 } },
    ],
  },
  {
    model: "AM103",
    category: "air_quality",
    sensorType: "air_quality",
    samples: [
      { description: "Normal CO2", decoded_payload: { temperature: 24.0, humidity: 55, co2: 420 } },
    ],
  },
  
  // Leak sensors
  {
    model: "LDDS75",
    category: "leak",
    sensorType: "leak",
    samples: [
      { description: "Leak detected", decoded_payload: { water_leak: true, battery_level: 80 } },
      { description: "No leak", decoded_payload: { water_leak: false, battery_level: 85 } },
    ],
  },
  {
    model: "R718WA2",
    category: "leak",
    sensorType: "leak",
    samples: [
      { description: "Leak detected", decoded_payload: { leak: true, battery_voltage: 3.2 } },
    ],
  },
  
  // Motion sensors
  {
    model: "TBMS100",
    category: "motion",
    sensorType: "motion",
    samples: [
      { description: "Motion detected", decoded_payload: { motion: true, battery_level: 85 } },
      { description: "No motion", decoded_payload: { motion: false, battery_level: 82 } },
    ],
  },
  
  // GPS sensors
  {
    model: "LT-22222-L",
    category: "gps",
    sensorType: "gps",
    samples: [
      { description: "Valid GPS fix", decoded_payload: { latitude: 40.7128, longitude: -74.0060, battery_level: 75 } },
    ],
  },
  {
    model: "TBS220",
    category: "gps",
    sensorType: "gps",
    samples: [
      { description: "Nested GPS object", decoded_payload: { gps: { lat: 40.7128, lon: -74.0060 }, battery_level: 80 } },
    ],
  },
  
  // Metering sensors
  {
    model: "EM500-PP",
    category: "metering",
    sensorType: "metering",
    samples: [
      { description: "Counter reading", decoded_payload: { counter: 100, battery_level: 90 } },
    ],
  },
  {
    model: "KONA Pulse Counter",
    category: "metering",
    sensorType: "metering",
    samples: [
      { description: "Pulse count", decoded_payload: { pulse_count: 1234, total_count: 5678 } },
    ],
  },
  
  // Multi-sensor
  {
    model: "EM300-MCS",
    category: "multi_sensor",
    sensorType: "temperature",
    samples: [
      { description: "Multi-sensor reading", decoded_payload: { temperature: 22.0, humidity: 50, door_status: "closed", battery_level: 85 } },
    ],
  },
];

// ============================================================================
// TESTS: Sample Classification
// ============================================================================

Deno.test("Payload Inference - Each sample matches expected type", async (t) => {
  for (const sampleDef of ALL_SAMPLES) {
    for (const sample of sampleDef.samples) {
      await t.step(`${sampleDef.model}: ${sample.description}`, () => {
        const result = inferPayloadType(sample.decoded_payload);
        
        // Must not fall to unclassified (unless explicitly expected)
        assertNotEquals(
          result.payloadType,
          "unclassified",
          `Sample should be classified, not unclassified. Reasons: ${result.reasons.map(r => r.message).join("; ")}`
        );
        
        // Must match expected category or be compatible
        const expectedTypes = [sampleDef.category, sampleDef.sensorType];
        const typeMatches = expectedTypes.includes(result.payloadType) || 
                           result.sensorType === sampleDef.sensorType;
        
        assert(
          typeMatches,
          `Expected ${sampleDef.category}/${sampleDef.sensorType}, got ${result.payloadType}/${result.sensorType}`
        );
        
        // Must have reasonable confidence
        assert(
          result.confidence >= 0.5,
          `Confidence ${result.confidence} is too low for ${sampleDef.model}`
        );
        
        // Must have explainable reasons
        assert(
          result.reasons.length > 0,
          `No inference reasons provided for ${sampleDef.model}`
        );
        
        // Schema version must match current
        assertEquals(result.schemaVersion, REGISTRY_VERSION);
      });
    }
  }
});

// ============================================================================
// TESTS: Ambiguity Detection
// ============================================================================

Deno.test("Payload Inference - Ambiguity detection for overlapping payloads", () => {
  // EM300-MCS has door_status AND temperature - should NOT be ambiguous
  const multiSensorPayload = {
    temperature: 22.0,
    humidity: 50,
    door_status: "closed",
    battery_level: 85,
  };
  
  const result = inferPayloadType(multiSensorPayload);
  
  // Should classify as multi_sensor, not be ambiguous
  assertEquals(result.payloadType, "multi_sensor");
  assertEquals(result.isAmbiguous, false);
  assertEquals(result.model, "EM300-MCS");
});

Deno.test("Payload Inference - No ambiguity for clear door sensor", () => {
  const doorPayload = {
    door_status: "open",
    battery_level: 75,
  };
  
  const result = inferPayloadType(doorPayload);
  
  assertEquals(result.payloadType, "door");
  assertEquals(result.isAmbiguous, false);
  assert(result.confidence >= 0.9, "Door sensor should have high confidence");
});

// ============================================================================
// TESTS: Unclassified Handling
// ============================================================================

Deno.test("Payload Inference - Unknown payload returns unclassified with reason", () => {
  const unknownPayload = {
    foo: "bar",
    unknown_field: 123,
    random_data: [1, 2, 3],
  };
  
  const result = inferPayloadType(unknownPayload);
  
  assertEquals(result.payloadType, "unclassified");
  assertEquals(result.confidence, 0);
  assertEquals(result.model, null);
  
  // Must have a reason explaining why
  const hasNoMatchReason = result.reasons.some(
    r => r.rule === "no_discriminator_match" || r.rule === "no_schema_match"
  );
  assert(hasNoMatchReason, "Should explain why payload couldn't be classified");
});

Deno.test("Payload Inference - Null payload returns unclassified", () => {
  const result = inferPayloadType(null);
  
  assertEquals(result.payloadType, "unclassified");
  assertEquals(result.confidence, 0);
  
  const hasInvalidReason = result.reasons.some(r => r.rule === "invalid_payload");
  assert(hasInvalidReason);
});

Deno.test("Payload Inference - Empty payload returns unclassified", () => {
  const result = inferPayloadType({});
  
  assertEquals(result.payloadType, "unclassified");
  assertEquals(result.confidence, 0);
  
  const hasEmptyReason = result.reasons.some(r => r.rule === "empty_payload");
  assert(hasEmptyReason);
});

// ============================================================================
// TESTS: Confidence Scoring
// ============================================================================

Deno.test("Payload Inference - High-priority fields have higher confidence", () => {
  const doorPayload = { door_status: "closed", battery_level: 90 };
  const tempPayload = { temperature: 22.0 };
  
  const doorResult = inferPayloadType(doorPayload);
  const tempResult = inferPayloadType(tempPayload);
  
  // Door sensors are more distinctive, should have higher confidence
  assert(
    doorResult.confidence > tempResult.confidence,
    `Door confidence (${doorResult.confidence}) should be > temp confidence (${tempResult.confidence})`
  );
});

Deno.test("Payload Inference - Multiple matching fields increase confidence", () => {
  const minimalPayload = { co2: 450 };
  const fullPayload = { temperature: 23.5, humidity: 50, co2: 450, tvoc: 120 };
  
  const minimalResult = inferPayloadType(minimalPayload);
  const fullResult = inferPayloadType(fullPayload);
  
  // Both should be air_quality, but full payload should have higher confidence
  assertEquals(minimalResult.payloadType, "air_quality");
  assertEquals(fullResult.payloadType, "air_quality");
  
  assert(
    fullResult.confidence >= minimalResult.confidence,
    "Full payload should have >= confidence than minimal"
  );
});

// ============================================================================
// TESTS: Model Inference
// ============================================================================

Deno.test("Payload Inference - Correct model inference for LDS02", () => {
  const payload = { door_status: "closed", battery_level: 90 };
  const result = inferPayloadType(payload);
  
  assertEquals(result.model, "LDS02");
});

Deno.test("Payload Inference - Correct model inference for AM319", () => {
  const payload = { temperature: 23.5, humidity: 50, co2: 450, tvoc: 120 };
  const result = inferPayloadType(payload);
  
  assertEquals(result.model, "AM319");
});

// ============================================================================
// TESTS: Determinism
// ============================================================================

Deno.test("Payload Inference - Same input produces same output (deterministic)", () => {
  const payload = { temperature: 22.5, humidity: 45.0, battery_level: 80 };
  
  const result1 = inferPayloadType(payload);
  const result2 = inferPayloadType(payload);
  const result3 = inferPayloadType(payload);
  
  // All results should be identical
  assertEquals(result1.payloadType, result2.payloadType);
  assertEquals(result2.payloadType, result3.payloadType);
  assertEquals(result1.confidence, result2.confidence);
  assertEquals(result2.confidence, result3.confidence);
  assertEquals(result1.model, result2.model);
  assertEquals(result2.model, result3.model);
});

// ============================================================================
// TESTS: Edge Cases
// ============================================================================

Deno.test("Payload Inference - Handles extra unknown fields gracefully", () => {
  const payload = {
    door_status: "open",
    battery_level: 85,
    unknown_extra_field: "should be ignored",
    another_field: 12345,
  };
  
  const result = inferPayloadType(payload);
  
  // Should still classify as door, ignoring extra fields
  assertEquals(result.payloadType, "door");
  assert(result.confidence >= 0.8);
});

Deno.test("Payload Inference - Case-sensitive field matching", () => {
  // Payload with wrong case should not match
  const wrongCasePayload = {
    Door_Status: "open", // Wrong case
    Battery_Level: 85,
  };
  
  const result = inferPayloadType(wrongCasePayload);
  
  // Should be unclassified since field names don't match
  assertEquals(result.payloadType, "unclassified");
});
