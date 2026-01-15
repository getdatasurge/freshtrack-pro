import type {
  ActionEligibility,
  TTNConfigState,
  GatewayForEligibility,
  ActionPermissions,
} from "./types";

/**
 * Check if a gateway can be provisioned to TTN.
 *
 * Order of checks:
 * 1. Already provisioned
 * 2. Permission check
 * 3. TTN configuration
 * 4. Gateway EUI
 */
export function canProvisionGateway(
  gateway: GatewayForEligibility,
  ttnConfig: TTNConfigState | null | undefined,
  permissions?: ActionPermissions
): ActionEligibility {
  // Already provisioned
  if (gateway.ttn_gateway_id) {
    return {
      allowed: false,
      code: "GATEWAY_ALREADY_PROVISIONED",
      reason: "Gateway is already provisioned to TTN",
    };
  }

  // Permission check (if permissions provided)
  if (permissions && permissions.canManageGateways === false) {
    return {
      allowed: false,
      code: "PERMISSION_DENIED",
      reason: "You do not have permission to provision gateways",
    };
  }

  // TTN configuration checks
  if (!ttnConfig?.isEnabled) {
    return {
      allowed: false,
      code: "TTN_NOT_CONFIGURED",
      reason: "TTN connection is not enabled for this organization",
    };
  }

  if (!ttnConfig?.hasApiKey) {
    return {
      allowed: false,
      code: "TTN_MISSING_API_KEY",
      reason: "TTN API key is not configured",
    };
  }

  if (!ttnConfig?.applicationId) {
    return {
      allowed: false,
      code: "TTN_MISSING_APPLICATION",
      reason: "TTN application is not configured",
    };
  }

  // Check for wrong API key type (application keys can't provision gateways)
  if (ttnConfig?.credentialType === "application_api_key") {
    return {
      allowed: false,
      code: "TTN_WRONG_KEY_TYPE",
      reason: "Application API keys cannot provision gateways. Use a Personal API key with gateway rights.",
    };
  }

  // Check for missing gateway rights
  if (ttnConfig?.gatewayRightsVerified === false) {
    return {
      allowed: false,
      code: "TTN_MISSING_GATEWAY_RIGHTS",
      reason: "TTN API key lacks gateway provisioning permissions. Regenerate with gateways:write rights.",
    };
  }

  // Gateway EUI
  if (!gateway.gateway_eui) {
    return {
      allowed: false,
      code: "MISSING_GATEWAY_EUI",
      reason: "Gateway is missing EUI",
    };
  }

  // All checks passed
  return {
    allowed: true,
    code: "ALLOWED",
  };
}

/**
 * Check if a gateway can be edited.
 */
export function canEditGateway(
  gateway: GatewayForEligibility,
  permissions?: ActionPermissions
): ActionEligibility {
  if (permissions && permissions.canEdit === false) {
    return {
      allowed: false,
      code: "PERMISSION_DENIED",
      reason: "You do not have permission to edit gateways",
    };
  }

  return {
    allowed: true,
    code: "ALLOWED",
  };
}

/**
 * Check if a gateway can be deleted.
 */
export function canDeleteGateway(
  gateway: GatewayForEligibility,
  permissions?: ActionPermissions
): ActionEligibility {
  if (permissions && permissions.canManageGateways === false) {
    return {
      allowed: false,
      code: "PERMISSION_DENIED",
      reason: "You do not have permission to delete gateways",
    };
  }

  return {
    allowed: true,
    code: "ALLOWED",
  };
}
