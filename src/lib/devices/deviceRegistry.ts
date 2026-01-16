/**
 * Device Registry
 * Central registry of all supported device models with their definitions
 */

import {
  Activity,
  Thermometer,
  Droplets,
  Gauge,
  DoorClosed,
  MapPin,
  Cloud,
  Layers,
  HelpCircle,
  Radio,
  Radar,
} from "lucide-react";
import type { DeviceDefinition, DeviceCategory } from "./types";
import {
  TEMPERATURE_FIELD,
  HUMIDITY_FIELD,
  BATTERY_FIELD,
  RSSI_FIELD,
  SNR_FIELD,
  MOTION_FIELD,
  DOOR_OPEN_FIELD,
  TAMPER_FIELD,
  LEAK_DETECTED_FIELD,
  WATER_LEVEL_FIELD,
  DISTANCE_FIELD,
  CO2_FIELD,
  VOC_FIELD,
  LATITUDE_FIELD,
  LONGITUDE_FIELD,
  SPEED_FIELD,
  PULSE_COUNT_FIELD,
  FLOW_RATE_FIELD,
  LAST_PULSE_FIELD,
} from "./telemetryFields";

// ============================================================================
// Unknown/Fallback Device Definition
// ============================================================================

export const UNKNOWN_DEVICE: DeviceDefinition = {
  model: "UNKNOWN",
  displayName: "Unknown Device",
  category: "unknown",
  modelIcon: HelpCircle,
  categoryIcon: Radio,
  telemetryFields: [BATTERY_FIELD, RSSI_FIELD],
  capabilities: {},
  description: "Device model not recognized. Add to registry to enable full support.",
};

// ============================================================================
// Motion Sensors
// ============================================================================

const TBMS100: DeviceDefinition = {
  model: "TBMS100",
  displayName: "Milesight TBMS100",
  manufacturer: "Milesight",
  category: "motion",
  modelIcon: Activity,
  categoryIcon: Radar,
  telemetryFields: [MOTION_FIELD, BATTERY_FIELD, RSSI_FIELD, SNR_FIELD],
  capabilities: { motion: true, battery: true },
  description: "PIR Motion Sensor",
};

// ============================================================================
// Temperature Sensors
// ============================================================================

const EM300_TH: DeviceDefinition = {
  model: "EM300-TH",
  displayName: "Milesight EM300-TH",
  manufacturer: "Milesight",
  category: "temperature",
  modelIcon: Thermometer,
  categoryIcon: Thermometer,
  telemetryFields: [TEMPERATURE_FIELD, HUMIDITY_FIELD, BATTERY_FIELD],
  capabilities: { temperature: true, humidity: true, battery: true },
  description: "Temperature + Humidity Sensor",
};

const ERS: DeviceDefinition = {
  model: "ERS",
  displayName: "Elsys ERS",
  manufacturer: "Elsys",
  category: "temperature",
  modelIcon: Thermometer,
  categoryIcon: Thermometer,
  telemetryFields: [TEMPERATURE_FIELD, HUMIDITY_FIELD, BATTERY_FIELD],
  capabilities: { temperature: true, humidity: true, battery: true },
  description: "Indoor Temperature + Humidity Sensor",
};

// ============================================================================
// Leak Detection Sensors
// ============================================================================

const LDDS75: DeviceDefinition = {
  model: "LDDS75",
  displayName: "Dragino LDDS75",
  manufacturer: "Dragino",
  category: "leak",
  modelIcon: Droplets,
  categoryIcon: Droplets,
  telemetryFields: [WATER_LEVEL_FIELD, DISTANCE_FIELD, BATTERY_FIELD],
  capabilities: { leak: true, distance: true, battery: true },
  description: "Distance Detection Sensor / Water Level",
};

const R718WA2: DeviceDefinition = {
  model: "R718WA2",
  displayName: "Netvox R718WA2",
  manufacturer: "Netvox",
  category: "leak",
  modelIcon: Droplets,
  categoryIcon: Droplets,
  telemetryFields: [LEAK_DETECTED_FIELD, BATTERY_FIELD],
  capabilities: { leak: true, battery: true },
  description: "Wireless Water Leak Detector",
};

// ============================================================================
// Metering Sensors
// ============================================================================

const KONA_PULSE_COUNTER: DeviceDefinition = {
  model: "KONA Pulse Counter",
  displayName: "KONA Pulse Counter",
  manufacturer: "KONA",
  category: "metering",
  modelIcon: Gauge,
  categoryIcon: Gauge,
  telemetryFields: [PULSE_COUNT_FIELD, FLOW_RATE_FIELD, LAST_PULSE_FIELD, BATTERY_FIELD],
  capabilities: { pulse: true, battery: true },
  description: "Pulse Counter for Utility Metering",
};

// ============================================================================
// Door/Contact Sensors
// ============================================================================

const LDS02: DeviceDefinition = {
  model: "LDS02",
  displayName: "Dragino LDS02",
  manufacturer: "Dragino",
  category: "door",
  modelIcon: DoorClosed,
  categoryIcon: DoorClosed,
  telemetryFields: [DOOR_OPEN_FIELD, BATTERY_FIELD],
  capabilities: { door: true, battery: true },
  description: "LoRaWAN Door Sensor",
};

const R311A: DeviceDefinition = {
  model: "R311A",
  displayName: "Netvox R311A",
  manufacturer: "Netvox",
  category: "door",
  modelIcon: DoorClosed,
  categoryIcon: DoorClosed,
  telemetryFields: [DOOR_OPEN_FIELD, TAMPER_FIELD, BATTERY_FIELD],
  capabilities: { door: true, tamper: true, battery: true },
  description: "Wireless Door/Window Sensor",
};

// ============================================================================
// GPS/Location Sensors
// ============================================================================

const LT_22222_L: DeviceDefinition = {
  model: "LT-22222-L",
  displayName: "Dragino LT-22222-L",
  manufacturer: "Dragino",
  category: "gps",
  modelIcon: MapPin,
  categoryIcon: MapPin,
  telemetryFields: [LATITUDE_FIELD, LONGITUDE_FIELD, SPEED_FIELD, BATTERY_FIELD],
  capabilities: { gps: true, battery: true },
  description: "LoRaWAN Tracker with GPS",
};

// ============================================================================
// CO2 / Air Quality Sensors
// ============================================================================

const AM319: DeviceDefinition = {
  model: "AM319",
  displayName: "Milesight AM319",
  manufacturer: "Milesight",
  category: "air_quality",
  modelIcon: Cloud,
  categoryIcon: Cloud,
  telemetryFields: [CO2_FIELD, TEMPERATURE_FIELD, HUMIDITY_FIELD, VOC_FIELD],
  capabilities: { co2: true, voc: true, temperature: true, humidity: true },
  description: "3-in-1 Indoor Air Quality Sensor",
};

const ERS_CO2: DeviceDefinition = {
  model: "ERS CO2",
  displayName: "Elsys ERS CO2",
  manufacturer: "Elsys",
  category: "air_quality",
  modelIcon: Cloud,
  categoryIcon: Cloud,
  telemetryFields: [CO2_FIELD, TEMPERATURE_FIELD, HUMIDITY_FIELD],
  capabilities: { co2: true, temperature: true, humidity: true },
  description: "Indoor CO₂ + Temperature + Humidity Sensor",
};

// ============================================================================
// Multi-Sensor
// ============================================================================

const EM300_MCS: DeviceDefinition = {
  model: "EM300-MCS",
  displayName: "Milesight EM300-MCS",
  manufacturer: "Milesight",
  category: "multi_sensor",
  modelIcon: Layers,
  categoryIcon: Layers,
  telemetryFields: [DOOR_OPEN_FIELD, TEMPERATURE_FIELD, BATTERY_FIELD],
  capabilities: { door: true, temperature: true, battery: true },
  description: "Magnetic Contact Switch with Temperature",
};

// ============================================================================
// Device Registry Map
// ============================================================================

/**
 * Main device registry - keyed by model identifier
 * Keys MUST match the emulator's "model" field exactly
 */
export const DEVICE_REGISTRY: Record<string, DeviceDefinition> = {
  // Motion
  TBMS100,
  
  // Temperature
  "EM300-TH": EM300_TH,
  ERS,
  
  // Leak Detection
  LDDS75,
  R718WA2,
  
  // Metering
  "KONA Pulse Counter": KONA_PULSE_COUNTER,
  
  // Door/Contact
  LDS02,
  R311A,
  
  // GPS/Location
  "LT-22222-L": LT_22222_L,
  
  // CO2 / Air Quality
  AM319,
  "ERS CO2": ERS_CO2,
  
  // Multi-Sensor
  "EM300-MCS": EM300_MCS,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get device definition by model identifier
 * Returns UNKNOWN_DEVICE if model is not in registry
 */
export function getDeviceDefinition(model: string | null | undefined): DeviceDefinition {
  if (!model) return UNKNOWN_DEVICE;
  return DEVICE_REGISTRY[model] ?? UNKNOWN_DEVICE;
}

/**
 * Check if a model is known in the registry
 */
export function isKnownModel(model: string | null | undefined): boolean {
  if (!model) return false;
  return model in DEVICE_REGISTRY;
}

/**
 * Get all registered devices as an array
 */
export function getAllDevices(): DeviceDefinition[] {
  return Object.values(DEVICE_REGISTRY);
}

/**
 * Get devices grouped by category
 */
export function getDevicesByCategory(): Record<DeviceCategory, DeviceDefinition[]> {
  const grouped: Record<DeviceCategory, DeviceDefinition[]> = {
    motion: [],
    temperature: [],
    leak: [],
    metering: [],
    door: [],
    gps: [],
    air_quality: [],
    multi_sensor: [],
    unknown: [],
  };
  
  for (const device of getAllDevices()) {
    grouped[device.category].push(device);
  }
  
  return grouped;
}

/**
 * Search devices by name or model
 */
export function searchDevices(query: string): DeviceDefinition[] {
  const lowerQuery = query.toLowerCase();
  return getAllDevices().filter(
    (device) =>
      device.model.toLowerCase().includes(lowerQuery) ||
      device.displayName.toLowerCase().includes(lowerQuery) ||
      device.manufacturer?.toLowerCase().includes(lowerQuery)
  );
}
