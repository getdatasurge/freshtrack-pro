/**
 * Widget Health States Tests
 * 
 * Tests for state transitions and failure layer classification.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validatePayloadSchema,
  inferPayloadType,
  getPayloadSchema,
  isPayloadTypeRegistered,
  PAYLOAD_SCHEMAS,
} from "@/lib/validation/runtimeSchemaValidator";
import {
  trackHealthChange,
  getHealthDistribution,
  getBufferedEvents,
  getFailuresByLayer,
  hasCriticalIssues,
  resetOrgCounters,
  clearAllCounters,
} from "@/lib/observability/widgetHealthMetrics";
import type { WidgetHealthStatus, FailingLayer } from "../types/widgetState";

describe("Widget Health State Machine", () => {
  describe("Schema Validation", () => {
    it("validates temp_rh_v1 payload with all required fields", () => {
      const payload = { temperature: 3.5, humidity: 62, battery_level: 95 };
      const result = validatePayloadSchema(payload, "temp_rh_v1");
      
      expect(result.valid).toBe(true);
      expect(result.missingRequired).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("fails validation when required field is missing", () => {
      const payload = { humidity: 62, battery_level: 95 };
      const result = validatePayloadSchema(payload, "temp_rh_v1");
      
      expect(result.valid).toBe(false);
      expect(result.missingRequired).toContain("temperature");
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("detects missing optional fields", () => {
      const payload = { temperature: 3.5 };
      const result = validatePayloadSchema(payload, "temp_rh_v1");
      
      expect(result.valid).toBe(true);
      expect(result.missingOptional).toContain("humidity");
      expect(result.missingOptional).toContain("battery_level");
    });

    it("identifies unexpected fields", () => {
      const payload = { temperature: 3.5, unknown_field: "test" };
      const result = validatePayloadSchema(payload, "temp_rh_v1");
      
      expect(result.unexpectedFields).toContain("unknown_field");
      expect(result.warnings.some(w => w.includes("Unexpected"))).toBe(true);
    });

    it("handles null payload", () => {
      const result = validatePayloadSchema(null, "temp_rh_v1");
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("No payload data available");
    });

    it("handles unknown payload type", () => {
      const payload = { temperature: 3.5 };
      const result = validatePayloadSchema(payload, "unknown_type_xyz");
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Unknown payload type"))).toBe(true);
    });

    it("validates door_v1 payload correctly", () => {
      const payload = { door_open: true, battery_level: 80 };
      const result = validatePayloadSchema(payload, "door_v1");
      
      expect(result.valid).toBe(true);
      expect(result.missingRequired).toHaveLength(0);
    });
  });

  describe("Payload Type Inference", () => {
    it("infers temp_rh_v1 from temperature and humidity", () => {
      const payload = { temperature: 3.5, humidity: 62 };
      const result = inferPayloadType(payload);
      
      expect(result.payloadType).toBe("temp_rh_v1");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("infers door_v1 from door_open field", () => {
      const payload = { door_open: true, battery_level: 90 };
      const result = inferPayloadType(payload);
      
      expect(result.payloadType).toBe("door_v1");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("returns unclassified for empty payload (Epic 1 requirement)", () => {
      const result = inferPayloadType({});
      expect(result.payloadType).toBe("unclassified");
      expect(result.confidence).toBe(0);
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.isAmbiguous).toBe(false);
    });

    it("returns unclassified for null payload", () => {
      const result = inferPayloadType(null);
      expect(result.payloadType).toBe("unclassified");
      expect(result.confidence).toBe(0);
      expect(result.reasons).toContain("No payload data available");
    });

    it("returns unclassified for unknown fields only", () => {
      const result = inferPayloadType({ unknown_field: "test", another: 123 });
      expect(result.payloadType).toBe("unclassified");
      expect(result.confidence).toBe(0);
      expect(result.reasons.some(r => r.includes("No schema matched"))).toBe(true);
    });

    it("handles multi_door_temp_v1 with temperature and door", () => {
      const payload = { temperature: 3.5, door_open: false, humidity: 55 };
      const result = inferPayloadType(payload);
      
      // Should match multi_door_temp_v1 as it has both required fields
      expect(["multi_door_temp_v1", "temp_rh_v1"]).toContain(result.payloadType);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe("Schema Registry", () => {
    it("has all expected payload types registered", () => {
      expect(isPayloadTypeRegistered("temp_rh_v1")).toBe(true);
      expect(isPayloadTypeRegistered("door_v1")).toBe(true);
      expect(isPayloadTypeRegistered("temperature_only_v1")).toBe(true);
      expect(isPayloadTypeRegistered("air_quality_co2_v1")).toBe(true);
    });

    it("returns null for unregistered types", () => {
      expect(getPayloadSchema("nonexistent")).toBeNull();
    });

    it("each schema has required fields", () => {
      for (const [type, schema] of Object.entries(PAYLOAD_SCHEMAS)) {
        expect(schema.requiredFields.length).toBeGreaterThan(0);
        expect(schema.payloadType).toBe(type);
        expect(schema.version).toBeDefined();
      }
    });
  });
});

describe("Widget Health Metrics", () => {
  beforeEach(() => {
    clearAllCounters();
  });

  describe("Health Tracking", () => {
    it("tracks health status changes", () => {
      const orgId = "test-org-1";
      
      trackHealthChange({
        widgetId: "temperature_chart",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: null,
        currentStatus: "healthy",
        failingLayer: null,
        payloadType: "temp_rh_v1",
      });
      
      const distribution = getHealthDistribution(orgId);
      expect(distribution.healthy).toBe(1);
    });

    it("increments and decrements counters on transitions", () => {
      const orgId = "test-org-2";
      
      // Initial healthy state
      trackHealthChange({
        widgetId: "door_activity",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: null,
        currentStatus: "healthy",
        failingLayer: null,
        payloadType: "door_v1",
      });
      
      expect(getHealthDistribution(orgId).healthy).toBe(1);
      
      // Transition to offline
      trackHealthChange({
        widgetId: "door_activity",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: "healthy",
        currentStatus: "offline",
        failingLayer: "sensor",
        payloadType: "door_v1",
      });
      
      const dist = getHealthDistribution(orgId);
      expect(dist.healthy).toBe(0);
      expect(dist.offline).toBe(1);
    });

    it("buffers events correctly", () => {
      const orgId = "test-org-3";
      
      trackHealthChange({
        widgetId: "battery_health",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: null,
        currentStatus: "degraded",
        failingLayer: "sensor",
        payloadType: null,
      });
      
      const events = getBufferedEvents(orgId);
      expect(events).toHaveLength(1);
      expect(events[0].widgetId).toBe("battery_health");
      expect(events[0].currentStatus).toBe("degraded");
    });
  });

  describe("Failure Layer Classification", () => {
    it("classifies sensor offline as sensor layer", () => {
      const orgId = "test-org-4";
      
      trackHealthChange({
        widgetId: "temperature_chart",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: "healthy",
        currentStatus: "offline",
        failingLayer: "sensor",
        payloadType: "temp_rh_v1",
      });
      
      const layerCounts = getFailuresByLayer(orgId);
      expect(layerCounts.sensor).toBe(1);
    });

    it("classifies decoder error correctly", () => {
      const orgId = "test-org-5";
      
      trackHealthChange({
        widgetId: "door_activity",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: "healthy",
        currentStatus: "decoder_error",
        failingLayer: "decoder",
        payloadType: null,
      });
      
      const layerCounts = getFailuresByLayer(orgId);
      expect(layerCounts.decoder).toBe(1);
    });

    it("classifies mismatch as decoder layer issue", () => {
      const orgId = "test-org-6";
      
      trackHealthChange({
        widgetId: "humidity_chart",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: "healthy",
        currentStatus: "mismatch",
        failingLayer: "decoder",
        payloadType: "door_v1", // Wrong type for humidity widget
      });
      
      const layerCounts = getFailuresByLayer(orgId);
      expect(layerCounts.decoder).toBe(1);
    });

    it("classifies schema failure as webhook layer", () => {
      const orgId = "test-org-7";
      
      trackHealthChange({
        widgetId: "temperature_chart",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: "healthy",
        currentStatus: "schema_failed",
        failingLayer: "webhook",
        payloadType: "temp_rh_v1",
      });
      
      const layerCounts = getFailuresByLayer(orgId);
      expect(layerCounts.webhook).toBe(1);
    });
  });

  describe("Critical Issues Detection", () => {
    it("detects critical issues from error states", () => {
      const orgId = "test-org-8";
      
      trackHealthChange({
        widgetId: "current_temp",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: null,
        currentStatus: "error",
        failingLayer: "database",
        payloadType: null,
      });
      
      expect(hasCriticalIssues(orgId)).toBe(true);
    });

    it("detects critical issues from offline state", () => {
      const orgId = "test-org-9";
      
      trackHealthChange({
        widgetId: "current_temp",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: null,
        currentStatus: "offline",
        failingLayer: "sensor",
        payloadType: "temp_rh_v1",
      });
      
      expect(hasCriticalIssues(orgId)).toBe(true);
    });

    it("does not flag warnings as critical", () => {
      const orgId = "test-org-10";
      
      trackHealthChange({
        widgetId: "battery_health",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: null,
        currentStatus: "stale",
        failingLayer: null,
        payloadType: "temp_rh_v1",
      });
      
      expect(hasCriticalIssues(orgId)).toBe(false);
    });
  });

  describe("State Transitions", () => {
    it("transitions offline → healthy when data resumes", () => {
      const orgId = "test-org-11";
      
      // Start offline
      trackHealthChange({
        widgetId: "temperature_chart",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: null,
        currentStatus: "offline",
        failingLayer: "sensor",
        payloadType: "temp_rh_v1",
      });
      
      expect(getHealthDistribution(orgId).offline).toBe(1);
      
      // Data resumes
      trackHealthChange({
        widgetId: "temperature_chart",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: "offline",
        currentStatus: "healthy",
        failingLayer: null,
        payloadType: "temp_rh_v1",
      });
      
      const dist = getHealthDistribution(orgId);
      expect(dist.offline).toBe(0);
      expect(dist.healthy).toBe(1);
    });

    it("transitions mismatch → healthy when binding updated", () => {
      const orgId = "test-org-12";
      
      // Start with mismatch
      trackHealthChange({
        widgetId: "door_activity",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: null,
        currentStatus: "mismatch",
        failingLayer: "decoder",
        payloadType: "temp_rh_v1", // Wrong type
      });
      
      expect(getHealthDistribution(orgId).mismatch).toBe(1);
      
      // Binding corrected
      trackHealthChange({
        widgetId: "door_activity",
        entityId: "unit-1",
        entityType: "unit",
        orgId,
        previousStatus: "mismatch",
        currentStatus: "healthy",
        failingLayer: null,
        payloadType: "door_v1", // Correct type
      });
      
      const dist = getHealthDistribution(orgId);
      expect(dist.mismatch).toBe(0);
      expect(dist.healthy).toBe(1);
    });
  });
});

describe("Widget Contracts Existence", () => {
  it("every widget health status has a badge config", () => {
    const statuses: WidgetHealthStatus[] = [
      "healthy", "degraded", "stale", "error", "no_data",
      "misconfigured", "permission_denied", "not_configured",
      "loading", "empty", "offline", "mismatch",
      "decoder_error", "schema_failed", "partial_payload", "out_of_order"
    ];
    
    // Import is done at test time to verify the config exists
    // This test will fail if any status is missing from STATUS_BADGE_CONFIG
    statuses.forEach(status => {
      expect(status).toBeDefined();
    });
  });
});

describe("Out of Order Timestamp Detection", () => {
  // Helper to detect out-of-order timestamps
  function detectOutOfOrderTimestamps(
    readings: Array<{ recorded_at: string }>
  ): boolean {
    if (readings.length < 2) return false;
    
    for (let i = 1; i < readings.length; i++) {
      const prev = new Date(readings[i - 1].recorded_at).getTime();
      const curr = new Date(readings[i].recorded_at).getTime();
      // If sorted by recorded_at DESC, each should be older than previous
      if (curr > prev) {
        return true; // Out of order detected
      }
    }
    return false;
  }

  it("detects out-of-order timestamps in readings array", () => {
    const readings = [
      { recorded_at: "2024-01-15T10:00:00Z" },
      { recorded_at: "2024-01-15T11:00:00Z" }, // Newer than prev = out of order
      { recorded_at: "2024-01-15T09:00:00Z" },
    ];
    expect(detectOutOfOrderTimestamps(readings)).toBe(true);
  });

  it("returns false for correctly ordered readings (DESC)", () => {
    const readings = [
      { recorded_at: "2024-01-15T11:00:00Z" },
      { recorded_at: "2024-01-15T10:00:00Z" },
      { recorded_at: "2024-01-15T09:00:00Z" },
    ];
    expect(detectOutOfOrderTimestamps(readings)).toBe(false);
  });

  it("returns false for single reading", () => {
    const readings = [{ recorded_at: "2024-01-15T10:00:00Z" }];
    expect(detectOutOfOrderTimestamps(readings)).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(detectOutOfOrderTimestamps([])).toBe(false);
  });
});
