/**
 * Preview Mock Data Generator
 * 
 * Generates mock widget props for different preview modes,
 * allowing users to see how the dashboard looks in various data states.
 */

import { subHours, subMinutes } from "date-fns";
import type { PreviewMode } from "../types";
import type { EntityDashboardProps } from "../components/EntityDashboard";

type WidgetPropsMap = Record<string, Record<string, unknown>>;

/**
 * Generate mock sensor data for a given preview mode
 */
function getMockSensor(mode: PreviewMode): EntityDashboardProps["sensor"] | undefined {
  const now = new Date();

  switch (mode) {
    case "normal":
      return {
        id: "mock-sensor-1",
        name: "Temperature Sensor",
        last_seen_at: subMinutes(now, 5).toISOString(),
        battery_level: 85,
        signal_strength: -65,
        status: "online",
        sensor_type: "temperature",
      };

    case "no_data":
      return {
        id: "mock-sensor-1",
        name: "Temperature Sensor",
        last_seen_at: null,
        battery_level: null,
        signal_strength: null,
        status: "pending",
        sensor_type: "temperature",
      };

    case "offline":
      return {
        id: "mock-sensor-1",
        name: "Temperature Sensor",
        last_seen_at: subHours(now, 2).toISOString(),
        battery_level: 45,
        signal_strength: -85,
        status: "offline",
        sensor_type: "temperature",
      };

    case "alerting":
      return {
        id: "mock-sensor-1",
        name: "Temperature Sensor",
        last_seen_at: subMinutes(now, 3).toISOString(),
        battery_level: 72,
        signal_strength: -70,
        status: "online",
        sensor_type: "temperature",
      };

    default:
      return undefined;
  }
}

/**
 * Generate mock readings for a given preview mode
 */
function getMockReadings(mode: PreviewMode): EntityDashboardProps["readings"] {
  const now = new Date();

  switch (mode) {
    case "normal":
      // Generate 24 hours of normal readings
      return Array.from({ length: 48 }, (_, i) => ({
        id: `reading-${i}`,
        temperature: 3.5 + Math.sin(i / 6) * 0.5, // Slight variation around 3.5°C
        humidity: 65 + Math.sin(i / 8) * 5,
        recorded_at: subMinutes(now, i * 30).toISOString(),
      }));

    case "no_data":
      return [];

    case "offline":
      // Old readings, nothing recent
      return Array.from({ length: 24 }, (_, i) => ({
        id: `reading-${i}`,
        temperature: 4.0 + Math.random() * 0.5,
        humidity: 60 + Math.random() * 10,
        recorded_at: subHours(now, 2 + i * 0.5).toISOString(),
      }));

    case "alerting":
      // Recent readings showing temperature excursion
      return Array.from({ length: 24 }, (_, i) => ({
        id: `reading-${i}`,
        temperature: i < 6 ? 8.5 + Math.random() * 2 : 4.0 + Math.random() * 0.5, // High temp recently
        humidity: 70 + Math.random() * 5,
        recorded_at: subMinutes(now, i * 30).toISOString(),
      }));

    default:
      return [];
  }
}

/**
 * Generate mock derived status for a given preview mode
 */
function getMockDerivedStatus(mode: PreviewMode): EntityDashboardProps["derivedStatus"] {
  switch (mode) {
    case "normal":
      return {
        isOnline: true,
        statusLabel: "Normal",
        statusColor: "text-safe",
        statusBgColor: "bg-safe/10",
      };

    case "no_data":
      return {
        isOnline: false,
        statusLabel: "Awaiting Data",
        statusColor: "text-muted-foreground",
        statusBgColor: "bg-muted",
      };

    case "offline":
      return {
        isOnline: false,
        statusLabel: "Offline",
        statusColor: "text-warning",
        statusBgColor: "bg-warning/10",
      };

    case "alerting":
      return {
        isOnline: true,
        statusLabel: "Temperature Alert",
        statusColor: "text-alarm",
        statusBgColor: "bg-alarm/10",
      };

    default:
      return undefined;
  }
}

/**
 * Generate mock alerts for a given preview mode
 */
function getMockAlerts(mode: PreviewMode): EntityDashboardProps["alerts"] {
  if (mode === "alerting") {
    return [
      {
        id: "mock-alert-1",
        type: "temperature_excursion",
        severity: "critical" as const,
        title: "High Temperature Alert",
        message: "Temperature has exceeded the upper limit of 8°C",
        clearCondition: "Temperature must return below 8°C for 15 minutes",
      },
    ];
  }
  return [];
}

/**
 * Generate mock unit data for a given preview mode
 */
function getMockUnit(
  mode: PreviewMode,
  baseUnit?: EntityDashboardProps["unit"]
): EntityDashboardProps["unit"] {
  const now = new Date();
  const base = baseUnit || {
    id: "mock-unit-1",
    name: "Walk-in Cooler",
    unit_type: "cooler",
    temp_limit_high: 8,
    temp_limit_low: 0,
    last_temp_reading: null,
    last_reading_at: null,
  };

  switch (mode) {
    case "normal":
      return {
        ...base,
        last_temp_reading: 3.5,
        last_reading_at: subMinutes(now, 5).toISOString(),
      };

    case "no_data":
      return {
        ...base,
        last_temp_reading: null,
        last_reading_at: null,
      };

    case "offline":
      return {
        ...base,
        last_temp_reading: 4.2,
        last_reading_at: subHours(now, 2).toISOString(),
      };

    case "alerting":
      return {
        ...base,
        last_temp_reading: 9.5,
        last_reading_at: subMinutes(now, 3).toISOString(),
      };

    default:
      return base;
  }
}

/**
 * Generate mock last known good data for a given preview mode
 */
function getMockLastKnownGood(mode: PreviewMode): EntityDashboardProps["lastKnownGood"] {
  const now = new Date();

  switch (mode) {
    case "normal":
      return {
        temp: 3.5,
        at: subMinutes(now, 5).toISOString(),
        source: "sensor" as const,
      };

    case "no_data":
      return {
        temp: null,
        at: null,
        source: null,
      };

    case "offline":
      return {
        temp: 4.2,
        at: subHours(now, 2).toISOString(),
        source: "sensor" as const,
      };

    case "alerting":
      // Last known GOOD reading was before the alert
      return {
        temp: 4.0,
        at: subHours(now, 1).toISOString(),
        source: "sensor" as const,
      };

    default:
      return undefined;
  }
}

/**
 * Main function to generate mock props for a given preview mode
 */
export function generatePreviewMockProps(
  mode: PreviewMode,
  realProps: WidgetPropsMap,
  baseEntityProps: Partial<EntityDashboardProps>
): WidgetPropsMap {
  // If live mode, return real props unchanged
  if (mode === "live") {
    return realProps;
  }

  // Generate mock data based on mode
  const mockSensor = getMockSensor(mode);
  const mockReadings = getMockReadings(mode);
  const mockDerivedStatus = getMockDerivedStatus(mode);
  const mockAlerts = getMockAlerts(mode);
  const mockUnit = getMockUnit(mode, baseEntityProps.unit);
  const mockLastKnownGood = getMockLastKnownGood(mode);

  // Override props for each widget
  const mockProps: WidgetPropsMap = {};
  
  for (const widgetId of Object.keys(realProps)) {
    mockProps[widgetId] = {
      ...realProps[widgetId],
      sensor: mockSensor,
      readings: mockReadings,
      derivedStatus: mockDerivedStatus,
      alerts: mockAlerts,
      unit: mockUnit,
      lastKnownGood: mockLastKnownGood,
      temperature: mockUnit?.last_temp_reading,
      lastReadingAt: mockUnit?.last_reading_at,
      count: mockReadings.length,
    };
  }

  return mockProps;
}

/**
 * Get a description of what the preview mode simulates
 */
export function getPreviewModeDescription(mode: PreviewMode): string {
  switch (mode) {
    case "live":
      return "Showing real sensor data";
    case "normal":
      return "Simulating healthy sensors with normal readings";
    case "no_data":
      return "Simulating a sensor that has never reported data";
    case "offline":
      return "Simulating a sensor that stopped reporting 2 hours ago";
    case "alerting":
      return "Simulating an active temperature excursion alert";
    default:
      return "";
  }
}
