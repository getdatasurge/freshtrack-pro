/**
 * Deterministic Payload Classification Tests
 * 
 * CI Gate: These tests ensure every sample payload matches exactly one versioned
 * payload type, or is explicitly classified as "unclassified".
 * 
 * Ambiguous matches MUST fail CI (no silent ambiguity allowed).
 */

import { describe, it, expect } from "vitest";
import {
  inferPayloadType,
  PAYLOAD_SCHEMAS,
  isPayloadTypeRegistered,
} from "@/lib/validation/runtimeSchemaValidator";

/**
 * Sample payloads for each registered schema type.
 * Each sample MUST match exactly one schema with high confidence.
 */
const SAMPLE_PAYLOADS: Record<string, Record<string, unknown>> = {
  temp_rh_v1: { temperature: 3.5, humidity: 62, battery_level: 95 },
  door_v1: { door_open: true, battery_level: 90 },
  temperature_only_v1: { temperature: 5.2, battery_level: 80 },
  air_quality_co2_v1: { co2: 450, temperature: 22, humidity: 45 },
  multi_door_temp_v1: { temperature: 3.5, door_open: false, humidity: 55 },
  motion_v1: { motion_detected: true, battery_level: 75 },
  leak_v1: { leak_detected: false, battery_level: 85 },
  gps_v1: { latitude: 51.5074, longitude: -0.1278, battery_level: 60 },
  pulse_v1: { pulse_count: 1234, battery_level: 70 },
};

describe("Deterministic Payload Classification (CI Gate)", () => {
  describe("Each registered schema has a sample payload", () => {
    const registeredTypes = Object.keys(PAYLOAD_SCHEMAS);
    
    it("sample payloads exist for all registered schemas", () => {
      registeredTypes.forEach(type => {
        expect(
          SAMPLE_PAYLOADS[type],
          `Missing sample payload for schema: ${type}`
        ).toBeDefined();
      });
    });
  });

  describe("Sample payloads match their expected schema type", () => {
    Object.entries(SAMPLE_PAYLOADS).forEach(([expectedType, payload]) => {
      it(`classifies ${expectedType} sample correctly`, () => {
        const result = inferPayloadType(payload);
        
        // Must match the expected versioned type
        expect(result.payloadType).toBe(expectedType);
        
        // Must have reasonable confidence (>0.5)
        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
        
        // Must not be ambiguous
        expect(
          result.isAmbiguous,
          `Classification of ${expectedType} should not be ambiguous`
        ).toBe(false);
        
        // Must have at least one matched field
        expect(result.matchedFields.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Unknown payloads return 'unclassified' (never default to temperature)", () => {
    const unknownPayloads = [
      { name: "empty object", payload: {} },
      { name: "null", payload: null },
      { name: "undefined", payload: undefined },
      { name: "unknown fields only", payload: { foo: "bar", baz: 123 } },
      { name: "partial unrecognized", payload: { xyz: true, abc: "test" } },
    ];

    unknownPayloads.forEach(({ name, payload }) => {
      it(`returns 'unclassified' for ${name}`, () => {
        const result = inferPayloadType(payload as Record<string, unknown>);
        
        expect(result.payloadType).toBe("unclassified");
        expect(result.confidence).toBe(0);
        expect(result.reasons.length).toBeGreaterThan(0);
        
        // CRITICAL: Must never default to temperature or any other common type
        expect(result.payloadType).not.toBe("temperature");
        expect(result.payloadType).not.toBe("temp_rh_v1");
        expect(result.payloadType).not.toBe("temperature_only_v1");
      });
    });
  });

  describe("Reason chain is always non-empty", () => {
    it("provides reasons for successful classification", () => {
      const result = inferPayloadType({ temperature: 5.0, humidity: 50 });
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.some(r => r.includes("Matched schema"))).toBe(true);
    });

    it("provides reasons for unclassified payloads", () => {
      const result = inferPayloadType({ unknown: true });
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(
        result.reasons.some(r => r.includes("No schema matched") || r.includes("No payload data"))
      ).toBe(true);
    });
  });

  describe("Versioned payload types only (no unversioned values)", () => {
    it("all registered schemas have versioned identifiers", () => {
      Object.keys(PAYLOAD_SCHEMAS).forEach(type => {
        expect(
          type.match(/_v\d+$/),
          `Schema type "${type}" must end with version suffix (e.g., _v1)`
        ).not.toBeNull();
      });
    });

    it("inference always returns versioned types or 'unclassified'", () => {
      // Test various payloads
      const testCases = [
        { temperature: 5 },
        { door_open: true },
        { co2: 500 },
        { unknown: true },
        {},
      ];

      testCases.forEach(payload => {
        const result = inferPayloadType(payload);
        
        if (result.payloadType !== "unclassified") {
          expect(
            result.payloadType.match(/_v\d+$/),
            `Inferred type "${result.payloadType}" must be versioned or 'unclassified'`
          ).not.toBeNull();
        }
      });
    });
  });

  describe("Schema integrity checks", () => {
    Object.entries(PAYLOAD_SCHEMAS).forEach(([type, schema]) => {
      it(`schema ${type} has required structure`, () => {
        expect(schema.payloadType).toBe(type);
        expect(schema.version).toBeDefined();
        expect(schema.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(Array.isArray(schema.requiredFields)).toBe(true);
        expect(schema.requiredFields.length).toBeGreaterThan(0);
        expect(Array.isArray(schema.optionalFields)).toBe(true);
        expect(Array.isArray(schema.capabilities)).toBe(true);
      });
    });
  });

  describe("Ambiguity detection and handling", () => {
    it("flags multi_door_temp payloads as potentially ambiguous with alternates", () => {
      // This payload could match multiple schemas
      const result = inferPayloadType({ temperature: 3.5, door_open: true, humidity: 60 });
      
      // Should still resolve to a specific type
      expect(["multi_door_temp_v1", "temp_rh_v1"]).toContain(result.payloadType);
      
      // If ambiguous, alternates should be listed
      if (result.isAmbiguous) {
        expect(result.alternates.length).toBeGreaterThan(0);
        expect(result.reasons.some(r => r.includes("Ambiguous"))).toBe(true);
      }
    });

    it("non-ambiguous payloads have empty alternates array", () => {
      // Clear-cut door sensor payload
      const result = inferPayloadType({ door_open: true, open_count: 5 });
      
      expect(result.payloadType).toBe("door_v1");
      expect(result.isAmbiguous).toBe(false);
      expect(result.alternates).toHaveLength(0);
    });
  });
});

describe("Payload Type Registry Consistency", () => {
  it("all SAMPLE_PAYLOADS types are registered", () => {
    Object.keys(SAMPLE_PAYLOADS).forEach(type => {
      expect(
        isPayloadTypeRegistered(type),
        `Sample payload type "${type}" is not registered in PAYLOAD_SCHEMAS`
      ).toBe(true);
    });
  });

  it("schema count matches sample count", () => {
    const schemaCount = Object.keys(PAYLOAD_SCHEMAS).length;
    const sampleCount = Object.keys(SAMPLE_PAYLOADS).length;
    
    expect(
      sampleCount,
      `Missing samples: have ${sampleCount} samples but ${schemaCount} schemas`
    ).toBe(schemaCount);
  });
});
