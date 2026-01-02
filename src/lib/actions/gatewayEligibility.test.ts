import { describe, it, expect } from "vitest";
import {
  canProvisionGateway,
  canEditGateway,
  canDeleteGateway,
} from "./gatewayEligibility";
import type { TTNConfigState, GatewayForEligibility, ActionPermissions } from "./types";

describe("canProvisionGateway", () => {
  const validTtnConfig: TTNConfigState = {
    isEnabled: true,
    hasApiKey: true,
    applicationId: "test-app-id",
  };

  const validGateway: GatewayForEligibility = {
    gateway_eui: "AABBCCDDEEFF0011",
    ttn_gateway_id: null,
    status: "pending",
  };

  it("returns ALLOWED when all conditions are met", () => {
    const result = canProvisionGateway(validGateway, validTtnConfig);

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ALLOWED");
    expect(result.reason).toBeUndefined();
  });

  it("returns GATEWAY_ALREADY_PROVISIONED when ttn_gateway_id exists", () => {
    const gateway: GatewayForEligibility = {
      ...validGateway,
      ttn_gateway_id: "existing-gateway",
    };

    const result = canProvisionGateway(gateway, validTtnConfig);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("GATEWAY_ALREADY_PROVISIONED");
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("already provisioned");
  });

  it("returns PERMISSION_DENIED when user lacks canManageGateways", () => {
    const permissions: ActionPermissions = { canManageGateways: false };

    const result = canProvisionGateway(validGateway, validTtnConfig, permissions);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("PERMISSION_DENIED");
    expect(result.reason).toBeDefined();
  });

  it("returns TTN_NOT_CONFIGURED when isEnabled is false", () => {
    const ttnConfig: TTNConfigState = { ...validTtnConfig, isEnabled: false };

    const result = canProvisionGateway(validGateway, ttnConfig);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TTN_NOT_CONFIGURED");
    expect(result.reason).toBeDefined();
  });

  it("returns TTN_NOT_CONFIGURED when ttnConfig is null", () => {
    const result = canProvisionGateway(validGateway, null);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TTN_NOT_CONFIGURED");
    expect(result.reason).toBeDefined();
  });

  it("returns TTN_MISSING_API_KEY when hasApiKey is false", () => {
    const ttnConfig: TTNConfigState = { ...validTtnConfig, hasApiKey: false };

    const result = canProvisionGateway(validGateway, ttnConfig);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TTN_MISSING_API_KEY");
    expect(result.reason).toBeDefined();
  });

  it("returns TTN_MISSING_APPLICATION when applicationId is missing", () => {
    const ttnConfig: TTNConfigState = { ...validTtnConfig, applicationId: null };

    const result = canProvisionGateway(validGateway, ttnConfig);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TTN_MISSING_APPLICATION");
    expect(result.reason).toBeDefined();
  });

  it("returns MISSING_GATEWAY_EUI when gateway_eui is missing", () => {
    const gateway: GatewayForEligibility = { ...validGateway, gateway_eui: null };

    const result = canProvisionGateway(gateway, validTtnConfig);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_GATEWAY_EUI");
    expect(result.reason).toBeDefined();
  });

  it("reason is always defined when allowed is false", () => {
    const testCases = [
      { gateway: { ...validGateway, ttn_gateway_id: "exists" }, ttn: validTtnConfig },
      { gateway: validGateway, ttn: null },
      { gateway: validGateway, ttn: { ...validTtnConfig, isEnabled: false } },
      { gateway: validGateway, ttn: { ...validTtnConfig, hasApiKey: false } },
      { gateway: validGateway, ttn: { ...validTtnConfig, applicationId: null } },
      { gateway: { ...validGateway, gateway_eui: null }, ttn: validTtnConfig },
    ];

    testCases.forEach(({ gateway, ttn }) => {
      const result = canProvisionGateway(gateway, ttn);
      if (!result.allowed) {
        expect(result.reason).toBeDefined();
        expect(result.reason!.length).toBeGreaterThan(0);
      }
    });
  });
});

describe("canEditGateway", () => {
  const gateway: GatewayForEligibility = {
    gateway_eui: "AABBCCDDEEFF0011",
    ttn_gateway_id: null,
  };

  it("returns ALLOWED when permissions not provided", () => {
    const result = canEditGateway(gateway);

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ALLOWED");
  });

  it("returns ALLOWED when canEdit is true", () => {
    const result = canEditGateway(gateway, { canEdit: true });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ALLOWED");
  });

  it("returns PERMISSION_DENIED when canEdit is false", () => {
    const result = canEditGateway(gateway, { canEdit: false });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("PERMISSION_DENIED");
    expect(result.reason).toBeDefined();
  });
});

describe("canDeleteGateway", () => {
  const gateway: GatewayForEligibility = {
    gateway_eui: "AABBCCDDEEFF0011",
    ttn_gateway_id: null,
  };

  it("returns ALLOWED when permissions not provided", () => {
    const result = canDeleteGateway(gateway);

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ALLOWED");
  });

  it("returns ALLOWED when canManageGateways is true", () => {
    const result = canDeleteGateway(gateway, { canManageGateways: true });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ALLOWED");
  });

  it("returns PERMISSION_DENIED when canManageGateways is false", () => {
    const result = canDeleteGateway(gateway, { canManageGateways: false });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("PERMISSION_DENIED");
    expect(result.reason).toBeDefined();
  });
});
