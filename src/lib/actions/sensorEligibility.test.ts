import { describe, it, expect } from "vitest";
import {
  canProvisionSensor,
  canEditSensor,
  canDeleteSensor,
} from "./sensorEligibility";
import type { TTNConfigState, SensorForEligibility, ActionPermissions } from "./types";

describe("canProvisionSensor", () => {
  const validTtnConfig: TTNConfigState = {
    isEnabled: true,
    hasApiKey: true,
    applicationId: "test-app-id",
  };

  const validSensor: SensorForEligibility = {
    dev_eui: "0011223344556677",
    app_key: "AABBCCDDEEFF00112233445566778899",
    ttn_device_id: null,
    status: "pending",
  };

  it("returns ALLOWED when all conditions are met", () => {
    const result = canProvisionSensor(validSensor, validTtnConfig);

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ALLOWED");
    expect(result.reason).toBeUndefined();
  });

  it("returns SENSOR_ALREADY_PROVISIONED when ttn_device_id exists", () => {
    const sensor: SensorForEligibility = {
      ...validSensor,
      ttn_device_id: "existing-device",
    };

    const result = canProvisionSensor(sensor, validTtnConfig);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SENSOR_ALREADY_PROVISIONED");
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("already provisioned");
  });

  it("returns PERMISSION_DENIED when user lacks canManageSensors", () => {
    const permissions: ActionPermissions = { canManageSensors: false };

    const result = canProvisionSensor(validSensor, validTtnConfig, permissions);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("PERMISSION_DENIED");
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("permission");
  });

  it("returns TTN_NOT_CONFIGURED when isEnabled is false", () => {
    const ttnConfig: TTNConfigState = { ...validTtnConfig, isEnabled: false };

    const result = canProvisionSensor(validSensor, ttnConfig);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TTN_NOT_CONFIGURED");
    expect(result.reason).toBeDefined();
  });

  it("returns TTN_NOT_CONFIGURED when ttnConfig is null", () => {
    const result = canProvisionSensor(validSensor, null);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TTN_NOT_CONFIGURED");
    expect(result.reason).toBeDefined();
  });

  it("returns TTN_MISSING_API_KEY when hasApiKey is false", () => {
    const ttnConfig: TTNConfigState = { ...validTtnConfig, hasApiKey: false };

    const result = canProvisionSensor(validSensor, ttnConfig);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TTN_MISSING_API_KEY");
    expect(result.reason).toBeDefined();
  });

  it("returns TTN_MISSING_APPLICATION when applicationId is missing", () => {
    const ttnConfig: TTNConfigState = { ...validTtnConfig, applicationId: null };

    const result = canProvisionSensor(validSensor, ttnConfig);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TTN_MISSING_APPLICATION");
    expect(result.reason).toBeDefined();
  });

  it("returns MISSING_DEV_EUI when dev_eui is missing", () => {
    const sensor: SensorForEligibility = { ...validSensor, dev_eui: null };

    const result = canProvisionSensor(sensor, validTtnConfig);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_DEV_EUI");
    expect(result.reason).toBeDefined();
  });

  it("returns MISSING_APP_KEY when app_key is missing", () => {
    const sensor: SensorForEligibility = { ...validSensor, app_key: null };

    const result = canProvisionSensor(sensor, validTtnConfig);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_APP_KEY");
    expect(result.reason).toBeDefined();
  });

  it("reason is always defined when allowed is false", () => {
    const testCases = [
      { sensor: { ...validSensor, ttn_device_id: "exists" }, ttn: validTtnConfig },
      { sensor: validSensor, ttn: null },
      { sensor: validSensor, ttn: { ...validTtnConfig, isEnabled: false } },
      { sensor: validSensor, ttn: { ...validTtnConfig, hasApiKey: false } },
      { sensor: validSensor, ttn: { ...validTtnConfig, applicationId: null } },
      { sensor: { ...validSensor, dev_eui: null }, ttn: validTtnConfig },
      { sensor: { ...validSensor, app_key: null }, ttn: validTtnConfig },
    ];

    testCases.forEach(({ sensor, ttn }) => {
      const result = canProvisionSensor(sensor, ttn);
      if (!result.allowed) {
        expect(result.reason).toBeDefined();
        expect(result.reason!.length).toBeGreaterThan(0);
      }
    });
  });
});

describe("canEditSensor", () => {
  const sensor: SensorForEligibility = {
    dev_eui: "0011223344556677",
    app_key: null,
    ttn_device_id: null,
  };

  it("returns ALLOWED when permissions not provided", () => {
    const result = canEditSensor(sensor);

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ALLOWED");
  });

  it("returns ALLOWED when canEdit is true", () => {
    const result = canEditSensor(sensor, { canEdit: true });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ALLOWED");
  });

  it("returns PERMISSION_DENIED when canEdit is false", () => {
    const result = canEditSensor(sensor, { canEdit: false });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("PERMISSION_DENIED");
    expect(result.reason).toBeDefined();
  });
});

describe("canDeleteSensor", () => {
  const sensor: SensorForEligibility = {
    dev_eui: "0011223344556677",
    app_key: null,
    ttn_device_id: null,
  };

  it("returns ALLOWED when permissions not provided", () => {
    const result = canDeleteSensor(sensor);

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ALLOWED");
  });

  it("returns ALLOWED when canManageSensors is true", () => {
    const result = canDeleteSensor(sensor, { canManageSensors: true });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ALLOWED");
  });

  it("returns PERMISSION_DENIED when canManageSensors is false", () => {
    const result = canDeleteSensor(sensor, { canManageSensors: false });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("PERMISSION_DENIED");
    expect(result.reason).toBeDefined();
  });
});
