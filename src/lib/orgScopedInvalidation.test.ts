import { describe, it, expect } from "vitest";
import { ORG_SCOPED_QUERY_KEYS } from "./orgScopedInvalidation";

describe("ORG_SCOPED_QUERY_KEYS", () => {
  it("includes all nav-tree cache keys for proper impersonation cache invalidation", () => {
    // These keys are critical for impersonation to work correctly
    // When impersonation starts, all nav-tree caches must be invalidated
    // to ensure fresh data is fetched for the impersonated org
    const navTreeKeys = ORG_SCOPED_QUERY_KEYS.filter(
      (key) => key[0]?.toString().startsWith("nav-tree")
    );

    // Must include the base key for prefix matching
    expect(navTreeKeys).toContainEqual(["nav-tree"]);

    // Must include all specific nav-tree keys to ensure complete invalidation
    expect(navTreeKeys).toContainEqual(["nav-tree-all-sites"]);
    expect(navTreeKeys).toContainEqual(["nav-tree-areas"]);
    expect(navTreeKeys).toContainEqual(["nav-tree-units"]);
    expect(navTreeKeys).toContainEqual(["nav-tree-layouts"]);
    expect(navTreeKeys).toContainEqual(["nav-tree-sensors"]);
  });

  it("includes core entity cache keys", () => {
    const entityKeys = ["sites", "units", "areas", "alerts", "sensors", "lora-sensors", "devices"];

    entityKeys.forEach((key) => {
      expect(ORG_SCOPED_QUERY_KEYS).toContainEqual([key]);
    });
  });

  it("includes organization and profile cache keys", () => {
    const orgKeys = ["organizations", "organization", "profile", "branding", "user-role"];

    orgKeys.forEach((key) => {
      expect(ORG_SCOPED_QUERY_KEYS).toContainEqual([key]);
    });
  });

  it("includes alert and notification cache keys", () => {
    const alertKeys = [
      "alert-rules",
      "notification-policies",
      "notification-settings",
      "escalation-contacts",
      "escalation-policies",
    ];

    alertKeys.forEach((key) => {
      expect(ORG_SCOPED_QUERY_KEYS).toContainEqual([key]);
    });
  });

  it("has no duplicate keys", () => {
    const keyStrings = ORG_SCOPED_QUERY_KEYS.map((key) => JSON.stringify(key));
    const uniqueKeyStrings = [...new Set(keyStrings)];

    expect(keyStrings.length).toBe(uniqueKeyStrings.length);
  });
});

describe("Cache key coverage for impersonation", () => {
  it("ensures all critical impersonation data paths are covered", () => {
    // These are the data paths that must work correctly during impersonation:
    // 1. Sites → organization_id filter
    // 2. Areas → site_id filter (depends on sites)
    // 3. Units → area_id filter (depends on areas)
    // 4. Sensors → organization_id filter

    // The cache keys that control these paths must be in the invalidation list
    const criticalKeys = [
      "sites",
      "areas",
      "units",
      "lora-sensors",
      "nav-tree-all-sites",
      "nav-tree-areas",
      "nav-tree-units",
      "nav-tree-sensors",
    ];

    criticalKeys.forEach((key) => {
      const found = ORG_SCOPED_QUERY_KEYS.some(
        (k) => k[0] === key || (Array.isArray(k) && k.some(item => item === key))
      );
      expect(found).toBe(true);
    });
  });
});
