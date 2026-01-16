/**
 * useWidgetState Hook
 * 
 * Centralized logic for determining widget health status.
 * Each widget type has specific rules for what constitutes healthy, stale, error, etc.
 */

import { useMemo } from "react";
import { differenceInMinutes, differenceInHours } from "date-fns";
import type { WidgetStateInfo, WidgetHealthStatus, FailingLayer } from "../types/widgetState";
import type { WidgetProps } from "../types";
import { Settings, Radio, Calendar, RefreshCw, ExternalLink, Thermometer, Wifi, Lock, AlertTriangle } from "lucide-react";
import { translateError } from "@/lib/errors/userFriendlyErrors";

/**
 * Thresholds for determining staleness (in minutes).
 */
const STALE_THRESHOLDS = {
  sensor: 60,      // 1 hour without reading = stale
  gateway: 30,     // 30 min without gateway heartbeat = stale
  external: 120,   // 2 hours for external APIs = stale
};

/**
 * Thresholds for determining error state (in hours).
 */
const ERROR_THRESHOLDS = {
  sensor: 24,      // 24 hours without reading = error
  gateway: 4,      // 4 hours without gateway = error
  external: 24,    // 24 hours for external APIs = error
};

interface UseWidgetStateOptions {
  widgetId: string;
  props: WidgetProps;
  /** Override automatic status detection */
  statusOverride?: WidgetHealthStatus;
  /** Override automatic message */
  messageOverride?: string;
  /** Is data currently loading? */
  isLoading?: boolean;
  /** Error from data fetch */
  error?: Error | null;
  /** Timestamp of last successful data fetch */
  lastFetchTime?: Date | null;
  /** Is there any data to display? */
  hasData?: boolean;
}

/**
 * Determine widget state based on widget type and props.
 */
export function useWidgetState(options: UseWidgetStateOptions): WidgetStateInfo {
  const {
    widgetId,
    props,
    statusOverride,
    messageOverride,
    isLoading = false,
    error = null,
    lastFetchTime = null,
    hasData = true,
  } = options;

  return useMemo(() => {
    // Loading state
    if (isLoading) {
      return {
        status: "loading" as const,
        message: "Loading data...",
        lastUpdated: null,
      };
    }

    // Error state
    if (error) {
      return {
        status: "error" as const,
        message: "Failed to load data",
        rootCause: error.message || "An unexpected error occurred",
        action: {
          label: "Retry",
          icon: RefreshCw,
          onClick: () => window.location.reload(),
        },
        lastUpdated: lastFetchTime,
      };
    }

    // Status override (widget has custom logic)
    if (statusOverride) {
      return {
        status: statusOverride,
        message: messageOverride || getDefaultMessage(statusOverride),
        lastUpdated: lastFetchTime,
      };
    }

    // Widget-specific state detection
    return getWidgetSpecificState(widgetId, props, hasData, lastFetchTime);
  }, [widgetId, props, statusOverride, messageOverride, isLoading, error, lastFetchTime, hasData]);
}

/**
 * Get default message for a status.
 */
function getDefaultMessage(status: WidgetHealthStatus): string {
  switch (status) {
    case "healthy":
      return "Data is up to date";
    case "degraded":
      return "Some data issues detected";
    case "stale":
      return "No recent data";
    case "error":
      return "Data unavailable";
    case "no_data":
      return "No data available";
    case "misconfigured":
      return "Widget configuration error";
    case "permission_denied":
      return "Access denied";
    case "not_configured":
      return "Setup required";
    case "loading":
      return "Loading...";
    case "empty":
      return "No data in selected period";
    // Epic 3: New states
    case "offline":
      return "Sensor offline";
    case "mismatch":
      return "Payload type mismatch";
    case "decoder_error":
      return "Decoder error";
    case "schema_failed":
      return "Invalid data format";
    case "partial_payload":
      return "Missing data fields";
    case "out_of_order":
      return "Timestamps out of sequence";
    default:
      return "Unknown state";
  }
}

/**
 * Get widget-specific state based on widget type and props.
 */
function getWidgetSpecificState(
  widgetId: string,
  props: WidgetProps,
  hasData: boolean,
  lastFetchTime: Date | null
): WidgetStateInfo {
  const { sensor, unit, site, readings, loraSensors, device } = props;

  // Temperature widgets - need sensor
  if (widgetId.includes("temperature") || widgetId === "current_temp") {
    if (!sensor && !device) {
      return {
        status: "not_configured",
        message: "No sensor assigned",
        rootCause: "This unit needs a temperature sensor to display readings",
        action: {
          label: "Assign Sensor",
          href: unit?.id ? `/settings?tab=sensors&unitId=${unit.id}` : "/settings?tab=sensors",
          icon: Settings,
        },
        lastUpdated: null,
      };
    }

    // Check sensor online status
    const lastSeen = sensor?.last_seen_at || device?.last_seen_at;
    if (lastSeen) {
      const lastSeenDate = new Date(lastSeen);
      const minutesAgo = differenceInMinutes(new Date(), lastSeenDate);
      const hoursAgo = differenceInHours(new Date(), lastSeenDate);

      if (hoursAgo >= ERROR_THRESHOLDS.sensor) {
        return {
          status: "offline",  // Epic 3: Use new "offline" state instead of "error"
          message: "Sensor offline",
          rootCause: `Last reading was ${hoursAgo} hours ago`,
          failingLayer: "sensor",
          action: {
            label: "Check Gateway",
            href: "/settings?tab=gateways",
            icon: Radio,
          },
          lastUpdated: lastSeenDate,
        };
      }

      if (minutesAgo >= STALE_THRESHOLDS.sensor) {
        return {
          status: "stale",
          message: "No recent readings",
          rootCause: `Last reading was ${minutesAgo} minutes ago`,
          lastUpdated: lastSeenDate,
        };
      }
    }

    // Check if we have readings data
    if (!hasData || (readings && readings.length === 0)) {
      return {
        status: "empty",
        message: "No readings in period",
        rootCause: "Try selecting a different time range",
        action: {
          label: "Change Range",
          icon: Calendar,
        },
        lastUpdated: lastFetchTime,
      };
    }

    return {
      status: "healthy",
      message: "Receiving data normally",
      lastUpdated: lastFetchTime || (sensor?.last_seen_at ? new Date(sensor.last_seen_at) : null),
    };
  }

  // Battery widget
  if (widgetId === "battery_health") {
    if (!sensor && loraSensors?.length === 0) {
      return {
        status: "not_configured",
        message: "No sensor assigned",
        rootCause: "Assign a sensor to monitor battery health",
        action: {
          label: "Assign Sensor",
          href: "/settings?tab=sensors",
          icon: Settings,
        },
        lastUpdated: null,
      };
    }

    const batteryLevel = sensor?.battery_level ?? loraSensors?.[0]?.battery_level;
    if (batteryLevel === null || batteryLevel === undefined) {
      return {
        status: "empty",
        message: "No battery data",
        rootCause: "Sensor has not reported battery level yet",
        lastUpdated: null,
      };
    }

    return {
      status: "healthy",
      message: `Battery at ${batteryLevel}%`,
      lastUpdated: lastFetchTime,
    };
  }

  // Door activity widget
  if (widgetId === "door_activity") {
    // Check if unit has door sensor capability
    const hasDoorSensor = sensor?.sensor_type === "door" || 
      loraSensors?.some(s => s.sensor_type === "door");

    if (!hasDoorSensor && sensor?.sensor_type !== "door") {
      return {
        status: "not_configured",
        message: "No door sensor",
        rootCause: "This unit doesn't have a door sensor assigned",
        action: {
          label: "Configure Sensors",
          href: "/settings?tab=sensors",
          icon: Settings,
        },
        lastUpdated: null,
      };
    }

    if (!hasData) {
      return {
        status: "empty",
        message: "No door events recorded",
        rootCause: "Door sensor is configured but no events logged yet",
        lastUpdated: lastFetchTime,
      };
    }

    return {
      status: "healthy",
      message: "Door monitoring active",
      lastUpdated: lastFetchTime,
    };
  }

  // External weather widget
  if (widgetId === "external_weather" || widgetId === "temperature_vs_external") {
    if (!site?.latitude || !site?.longitude) {
      return {
        status: "not_configured",
        message: "Location not set",
        rootCause: "Site location is required for weather data",
        action: {
          label: "Set Location",
          href: site?.id ? `/sites/${site.id}/settings` : "/settings",
          icon: Settings,
        },
        lastUpdated: null,
      };
    }

    if (!hasData) {
      return {
        status: "stale",
        message: "Weather unavailable",
        rootCause: "Unable to fetch weather data for this location",
        action: {
          label: "Retry",
          icon: RefreshCw,
        },
        lastUpdated: lastFetchTime,
      };
    }

    return {
      status: "healthy",
      message: "Weather data available",
      lastUpdated: lastFetchTime,
    };
  }

  // Connected sensors widget
  if (widgetId === "connected_sensors") {
    if (!loraSensors || loraSensors.length === 0) {
      return {
        status: "not_configured",
        message: "No sensors connected",
        rootCause: "Add sensors to monitor this unit",
        action: {
          label: "Add Sensor",
          href: "/settings?tab=sensors",
          icon: Settings,
        },
        lastUpdated: null,
      };
    }

    // Check if any sensors are offline
    const offlineCount = loraSensors.filter(s => {
      if (!s.last_seen_at) return true;
      const hoursAgo = differenceInHours(new Date(), new Date(s.last_seen_at));
      return hoursAgo >= ERROR_THRESHOLDS.sensor;
    }).length;

    if (offlineCount === loraSensors.length) {
      return {
        status: "offline",  // Epic 3: Use new "offline" state
        message: "All sensors offline",
        rootCause: `${offlineCount} sensor(s) have not reported recently`,
        failingLayer: "sensor",
        action: {
          label: "Check Gateway",
          href: "/settings?tab=gateways",
          icon: Wifi,
        },
        lastUpdated: lastFetchTime,
      };
    }

    if (offlineCount > 0) {
      return {
        status: "stale",
        message: `${offlineCount} sensor(s) offline`,
        rootCause: "Some sensors have not reported recently",
        lastUpdated: lastFetchTime,
      };
    }

    return {
      status: "healthy",
      message: `${loraSensors.length} sensor(s) connected`,
      lastUpdated: lastFetchTime,
    };
  }

  // Humidity chart widget
  if (widgetId === "humidity_chart") {
    // Check if sensor supports humidity
    const supportsHumidity = sensor?.sensor_type === "temperature_humidity" ||
      loraSensors?.some(s => s.sensor_type === "temperature_humidity");

    if (!supportsHumidity) {
      return {
        status: "not_configured",
        message: "No humidity sensor",
        rootCause: "Current sensor doesn't report humidity",
        action: {
          label: "Upgrade Sensor",
          href: "/settings?tab=sensors",
          icon: Thermometer,
        },
        lastUpdated: null,
      };
    }

    if (!hasData || (readings && readings.every(r => r.humidity === null))) {
      return {
        status: "empty",
        message: "No humidity data",
        rootCause: "No humidity readings in selected period",
        action: {
          label: "Change Range",
          icon: Calendar,
        },
        lastUpdated: lastFetchTime,
      };
    }

    return {
      status: "healthy",
      message: "Humidity data available",
      lastUpdated: lastFetchTime,
    };
  }

  // Site-level widgets - need site context
  if (widgetId.includes("site_") || widgetId === "units_status_grid" || widgetId === "site_overview") {
    if (!site) {
      return {
        status: "not_configured",
        message: "No site context",
        rootCause: "This widget requires a site to be selected",
        lastUpdated: null,
      };
    }

    if (!hasData) {
      return {
        status: "empty",
        message: "No data available",
        rootCause: "Site has no data to display",
        lastUpdated: lastFetchTime,
      };
    }

    return {
      status: "healthy",
      message: "Site data loaded",
      lastUpdated: lastFetchTime,
    };
  }

  // Default fallback - assume healthy if we have data
  if (!hasData) {
    return {
      status: "empty",
      message: "No data available",
      rootCause: "No data found for the selected criteria",
      lastUpdated: lastFetchTime,
    };
  }

  return {
    status: "healthy",
    message: "Data loaded",
    lastUpdated: lastFetchTime,
  };
}

/**
 * Helper to create a simple healthy state.
 */
export function createHealthyState(lastUpdated?: Date | null): WidgetStateInfo {
  return {
    status: "healthy",
    message: "Data is up to date",
    lastUpdated: lastUpdated ?? null,
  };
}

/**
 * Helper to create a loading state.
 */
export function createLoadingState(): WidgetStateInfo {
  return {
    status: "loading",
    message: "Loading data...",
    lastUpdated: null,
  };
}

/**
 * Helper to create an error state with user-friendly translation.
 */
export function createErrorState(
  error: Error | string, 
  lastUpdated?: Date | null,
  failingLayer?: FailingLayer
): WidgetStateInfo {
  const errorString = typeof error === "string" ? error : error.message;
  const translated = translateError(errorString);
  
  return {
    status: "error",
    message: translated.user,
    rootCause: translated.suggestion || errorString,
    failingLayer,
    technicalDetails: translated.technical,
    action: {
      label: "Retry",
      icon: RefreshCw,
      onClick: () => window.location.reload(),
    },
    lastUpdated: lastUpdated ?? null,
  };
}

/**
 * Helper to create an empty state.
 */
export function createEmptyState(
  message: string,
  rootCause?: string,
  lastUpdated?: Date | null
): WidgetStateInfo {
  return {
    status: "empty",
    message,
    rootCause,
    lastUpdated: lastUpdated ?? null,
  };
}

/**
 * Helper to create a not configured state.
 */
export function createNotConfiguredState(
  message: string,
  rootCause: string,
  actionLabel: string,
  actionHref: string
): WidgetStateInfo {
  return {
    status: "not_configured",
    message,
    rootCause,
    action: {
      label: actionLabel,
      href: actionHref,
      icon: Settings,
    },
    lastUpdated: null,
  };
}

/**
 * Helper to create a degraded state.
 */
export function createDegradedState(
  message: string,
  rootCause?: string,
  failingLayer?: FailingLayer,
  lastUpdated?: Date | null
): WidgetStateInfo {
  return {
    status: "degraded",
    message,
    rootCause,
    failingLayer,
    lastUpdated: lastUpdated ?? null,
  };
}

/**
 * Helper to create a permission denied state.
 */
export function createPermissionDeniedState(resource?: string): WidgetStateInfo {
  return {
    status: "permission_denied",
    message: "Access denied",
    rootCause: resource ? `You don't have permission to view ${resource}` : "Contact your administrator for access",
    action: {
      label: "Request Access",
      icon: Lock,
    },
    lastUpdated: null,
  };
}

/**
 * Helper to create a misconfigured state.
 */
export function createMisconfiguredState(
  message: string,
  suggestion: string,
  actionLabel?: string,
  actionHref?: string
): WidgetStateInfo {
  return {
    status: "misconfigured",
    message,
    rootCause: suggestion,
    action: actionLabel ? {
      label: actionLabel,
      href: actionHref,
      icon: AlertTriangle,
    } : undefined,
    lastUpdated: null,
  };
}

// ============================================================================
// Epic 3: NEW STATE HELPERS
// ============================================================================

/**
 * Helper to create an offline state.
 */
export function createOfflineState(
  message: string,
  rootCause: string,
  lastUpdated?: Date | null
): WidgetStateInfo {
  return {
    status: "offline",
    message,
    rootCause,
    failingLayer: "sensor",
    action: {
      label: "Check Gateway",
      href: "/settings?tab=gateways",
      icon: Radio,
    },
    lastUpdated: lastUpdated ?? null,
  };
}

/**
 * Helper to create a payload type mismatch state.
 */
export function createMismatchState(
  expectedType: string,
  receivedType: string,
  lastUpdated?: Date | null
): WidgetStateInfo {
  return {
    status: "mismatch",
    message: "Payload type mismatch",
    rootCause: `Expected "${expectedType}" but received "${receivedType}"`,
    failingLayer: "decoder",
    technicalDetails: `Widget requires payload type "${expectedType}" but sensor is sending "${receivedType}". Update the sensor binding or switch to a compatible widget.`,
    action: {
      label: "View Sensor",
      href: "/settings?tab=sensors",
      icon: Settings,
    },
    lastUpdated: lastUpdated ?? null,
  };
}

/**
 * Helper to create a decoder error state.
 */
export function createDecoderErrorState(
  errorMessage: string,
  lastUpdated?: Date | null
): WidgetStateInfo {
  return {
    status: "decoder_error",
    message: "Decoder error",
    rootCause: errorMessage,
    failingLayer: "decoder",
    technicalDetails: "The TTN decoder returned an error or invalid data. Check the decoder configuration in The Things Network console.",
    action: {
      label: "View Documentation",
      href: "https://docs.lovable.dev/features/security",
      icon: ExternalLink,
    },
    lastUpdated: lastUpdated ?? null,
  };
}

/**
 * Helper to create a schema validation failed state.
 */
export function createSchemaFailedState(
  missingFields: string[],
  lastUpdated?: Date | null
): WidgetStateInfo {
  return {
    status: "schema_failed",
    message: "Invalid data format",
    rootCause: `Missing required fields: ${missingFields.join(", ")}`,
    failingLayer: "webhook",
    technicalDetails: "The payload does not match the expected schema. Ensure the decoder is outputting all required fields.",
    action: {
      label: "View Diagnostics",
      icon: AlertTriangle,
    },
    lastUpdated: lastUpdated ?? null,
  };
}

/**
 * Helper to create a partial payload state.
 */
export function createPartialPayloadState(
  missingOptional: string[],
  lastUpdated?: Date | null
): WidgetStateInfo {
  return {
    status: "partial_payload",
    message: "Missing optional data",
    rootCause: `Missing fields: ${missingOptional.join(", ")}`,
    failingLayer: "decoder",
    technicalDetails: "Some optional fields are missing from the payload. Widget functionality may be limited.",
    lastUpdated: lastUpdated ?? null,
  };
}

/**
 * Helper to create an out-of-order timestamps state.
 */
export function createOutOfOrderState(
  lastUpdated?: Date | null
): WidgetStateInfo {
  return {
    status: "out_of_order",
    message: "Timestamps out of sequence",
    rootCause: "Readings arrived in non-chronological order",
    failingLayer: "database",
    technicalDetails: "Sensor readings have timestamps that are out of order. This may indicate clock sync issues or delayed message delivery.",
    action: {
      label: "View Diagnostics",
      icon: AlertTriangle,
    },
    lastUpdated: lastUpdated ?? null,
  };
}

// ============================================================================
// Epic 3: OUT-OF-ORDER TIMESTAMP DETECTION
// ============================================================================

/**
 * Detect if readings have out-of-order timestamps.
 * Assumes readings are sorted by recorded_at DESC (newest first).
 * Returns true if any reading has a newer timestamp than the one before it.
 */
export function detectOutOfOrderTimestamps(
  readings: Array<{ recorded_at: string }> | null | undefined
): boolean {
  if (!readings || readings.length < 2) return false;
  
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
