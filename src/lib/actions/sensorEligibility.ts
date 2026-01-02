import type {
  ActionEligibility,
  TTNConfigState,
  SensorForEligibility,
  ActionPermissions,
} from "./types";

/**
 * Check if a sensor can be provisioned to TTN.
 *
 * Order of checks:
 * 1. Already provisioned
 * 2. Permission check
 * 3. TTN configuration
 * 4. OTAA credentials (DevEUI, AppKey)
 */
export function canProvisionSensor(
  sensor: SensorForEligibility,
  ttnConfig: TTNConfigState | null | undefined,
  permissions?: ActionPermissions
): ActionEligibility {
  // Already provisioned
  if (sensor.ttn_device_id) {
    return {
      allowed: false,
      code: "SENSOR_ALREADY_PROVISIONED",
      reason: "Sensor is already provisioned to TTN",
    };
  }

  // Permission check (if permissions provided)
  if (permissions && permissions.canManageSensors === false) {
    return {
      allowed: false,
      code: "PERMISSION_DENIED",
      reason: "You do not have permission to provision sensors",
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

  // OTAA credentials
  if (!sensor.dev_eui) {
    return {
      allowed: false,
      code: "MISSING_DEV_EUI",
      reason: "Sensor is missing DevEUI",
    };
  }

  if (!sensor.app_key) {
    return {
      allowed: false,
      code: "MISSING_APP_KEY",
      reason: "Sensor is missing AppKey for OTAA provisioning",
    };
  }

  // All checks passed
  return {
    allowed: true,
    code: "ALLOWED",
  };
}

/**
 * Check if a sensor can be edited.
 */
export function canEditSensor(
  sensor: SensorForEligibility,
  permissions?: ActionPermissions
): ActionEligibility {
  if (permissions && permissions.canEdit === false) {
    return {
      allowed: false,
      code: "PERMISSION_DENIED",
      reason: "You do not have permission to edit sensors",
    };
  }

  return {
    allowed: true,
    code: "ALLOWED",
  };
}

/**
 * Check if a sensor can be deleted.
 */
export function canDeleteSensor(
  sensor: SensorForEligibility,
  permissions?: ActionPermissions
): ActionEligibility {
  if (permissions && permissions.canManageSensors === false) {
    return {
      allowed: false,
      code: "PERMISSION_DENIED",
      reason: "You do not have permission to delete sensors",
    };
  }

  return {
    allowed: true,
    code: "ALLOWED",
  };
}
