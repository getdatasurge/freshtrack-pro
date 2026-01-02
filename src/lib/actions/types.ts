/**
 * Action eligibility result returned by all eligibility helper functions.
 * Enforces that disabled actions always have a reason.
 */
export interface ActionEligibility {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Human-readable explanation (required when allowed is false) */
  reason?: string;
  /** Stable identifier for tests and telemetry */
  code: ActionCode;
}

/**
 * Stable action codes for tests and telemetry.
 * Use these to assert on specific disabled reasons.
 */
export type ActionCode =
  // General
  | "ALLOWED"
  | "PERMISSION_DENIED"
  // TTN related
  | "TTN_NOT_CONFIGURED"
  | "TTN_MISSING_API_KEY"
  | "TTN_MISSING_APPLICATION"
  | "TTN_WRONG_KEY_TYPE"
  | "TTN_MISSING_GATEWAY_RIGHTS"
  // Sensor specific
  | "MISSING_DEV_EUI"
  | "MISSING_APP_KEY"
  | "SENSOR_ALREADY_PROVISIONED"
  // Gateway specific
  | "MISSING_GATEWAY_EUI"
  | "GATEWAY_ALREADY_PROVISIONED"
  // Status related
  | "INVALID_STATUS"
  | "IN_PROGRESS";

/**
 * TTN configuration state used by eligibility helpers.
 */
export interface TTNConfigState {
  isEnabled?: boolean;
  hasApiKey?: boolean;
  applicationId?: string | null;
  // New fields for gateway provisioning
  ownerScope?: "user" | "organization" | null;
  credentialType?: "personal_api_key" | "organization_api_key" | "application_api_key" | null;
  gatewayRightsVerified?: boolean;
}

/**
 * Minimal sensor data needed for eligibility checks.
 */
export interface SensorForEligibility {
  dev_eui?: string | null;
  app_key?: string | null;
  ttn_device_id?: string | null;
  status?: string;
}

/**
 * Minimal gateway data needed for eligibility checks.
 */
export interface GatewayForEligibility {
  gateway_eui?: string | null;
  ttn_gateway_id?: string | null;
  status?: string;
}

/**
 * Permission flags used by eligibility helpers.
 */
export interface ActionPermissions {
  canManageSensors?: boolean;
  canManageGateways?: boolean;
  canEdit?: boolean;
}
