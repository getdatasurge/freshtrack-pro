/**
 * Unit tests for TTN Permission Checking
 * 
 * These tests verify that permission analysis correctly identifies
 * missing and present rights, particularly RIGHT_APPLICATION_TRAFFIC_READ
 * which was previously missed due to probe-based detection.
 */

import { assertEquals, assertArrayIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computePermissionReport, REQUIRED_RIGHTS } from "./ttnPermissions.ts";

// Test with user's verified rights array (from curl /rights)
Deno.test("computePermissionReport - full permissions including TRAFFIC_READ", () => {
  // This is the actual rights array the user verified via TTN API
  const rights = [
    "RIGHT_APPLICATION_INFO",
    "RIGHT_APPLICATION_TRAFFIC_READ",        // Critical - was being missed!
    "RIGHT_APPLICATION_SETTINGS_BASIC",
    "RIGHT_APPLICATION_DEVICES_READ",
    "RIGHT_APPLICATION_DEVICES_WRITE",
    "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE",
  ];
  
  const result = computePermissionReport(rights);
  
  // All permissions should be valid
  assertEquals(result.valid, true, "Should be valid with all core rights");
  assertEquals(result.missing_core, [], "missing_core should be empty");
  assertEquals(result.can_configure_webhook, true);
  assertEquals(result.can_manage_devices, true);
  assertEquals(result.can_send_downlinks, true);
  assertEquals(result.rights.length, 6);
  
  // Verify the problematic right is correctly detected
  assertArrayIncludes(result.rights, ["RIGHT_APPLICATION_TRAFFIC_READ"]);
});

// Test with only TRAFFIC_READ missing
Deno.test("computePermissionReport - missing TRAFFIC_READ only", () => {
  const rights = [
    "RIGHT_APPLICATION_INFO",
    // RIGHT_APPLICATION_TRAFFIC_READ is missing!
    "RIGHT_APPLICATION_SETTINGS_BASIC",
    "RIGHT_APPLICATION_DEVICES_READ",
    "RIGHT_APPLICATION_DEVICES_WRITE",
  ];
  
  const result = computePermissionReport(rights);
  
  // Should be invalid because core permission is missing
  assertEquals(result.valid, false, "Should be invalid without TRAFFIC_READ");
  assertEquals(result.missing_core, ["RIGHT_APPLICATION_TRAFFIC_READ"]);
  assertEquals(result.can_configure_webhook, true, "Webhook should still work");
  assertEquals(result.can_manage_devices, true, "Devices should still work");
  assertEquals(result.can_send_downlinks, false, "Downlinks need separate right");
});

// Test with minimal permissions (read-only)
Deno.test("computePermissionReport - minimal read-only permissions", () => {
  const rights = [
    "RIGHT_APPLICATION_INFO",
    "RIGHT_APPLICATION_TRAFFIC_READ",
    "RIGHT_APPLICATION_DEVICES_READ",
  ];
  
  const result = computePermissionReport(rights);
  
  // Valid for core functionality
  assertEquals(result.valid, true, "Should be valid with core rights");
  assertEquals(result.missing_core, []);
  
  // But missing advanced features
  assertEquals(result.can_configure_webhook, false, "No webhook permission");
  assertEquals(result.can_manage_devices, false, "No device write permission");
  assertEquals(result.can_send_downlinks, false, "No downlink permission");
  
  assertEquals(result.missing_webhook, ["RIGHT_APPLICATION_SETTINGS_BASIC"]);
  assertEquals(result.missing_devices, ["RIGHT_APPLICATION_DEVICES_WRITE"]);
  assertEquals(result.missing_downlink, ["RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE"]);
});

// Test empty rights array
Deno.test("computePermissionReport - empty rights array", () => {
  const rights: string[] = [];
  
  const result = computePermissionReport(rights);
  
  assertEquals(result.valid, false);
  assertEquals(result.missing_core.length, 2); // INFO + TRAFFIC_READ
  assertArrayIncludes(result.missing_core, ["RIGHT_APPLICATION_INFO"]);
  assertArrayIncludes(result.missing_core, ["RIGHT_APPLICATION_TRAFFIC_READ"]);
});

// Test that REQUIRED_RIGHTS constants are correct
Deno.test("REQUIRED_RIGHTS - contains expected values", () => {
  // Verify core rights include the critical TRAFFIC_READ
  assertArrayIncludes(REQUIRED_RIGHTS.core, ["RIGHT_APPLICATION_TRAFFIC_READ"]);
  assertArrayIncludes(REQUIRED_RIGHTS.core, ["RIGHT_APPLICATION_INFO"]);
  
  // Verify other categories
  assertArrayIncludes(REQUIRED_RIGHTS.webhook, ["RIGHT_APPLICATION_SETTINGS_BASIC"]);
  assertArrayIncludes(REQUIRED_RIGHTS.devices, ["RIGHT_APPLICATION_DEVICES_READ"]);
  assertArrayIncludes(REQUIRED_RIGHTS.devices, ["RIGHT_APPLICATION_DEVICES_WRITE"]);
  assertArrayIncludes(REQUIRED_RIGHTS.downlink, ["RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE"]);
});
