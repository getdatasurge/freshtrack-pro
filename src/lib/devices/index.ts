/**
 * Device Registry Module
 * Public API exports for the registry-driven device system
 */

// Types
export type {
  DeviceCategory,
  TelemetryFieldType,
  TelemetryFieldDefinition,
  DeviceCapabilities,
  DeviceDefinition,
  CategoryDefinition,
  NormalizedDevice,
} from "./types";

export { SENSOR_TYPE_TO_CATEGORY } from "./types";

// Device Registry
export {
  DEVICE_REGISTRY,
  UNKNOWN_DEVICE,
  getDeviceDefinition,
  isKnownModel,
  getAllDevices,
  getDevicesByCategory,
  searchDevices,
} from "./deviceRegistry";

// Category Registry
export {
  CATEGORY_REGISTRY,
  getCategoryDefinition,
  getAllCategories,
  getSelectableCategories,
} from "./categoryRegistry";

// Telemetry Fields
export {
  // Formatters
  formatTemperature,
  formatHumidity,
  formatBattery,
  formatSignal,
  formatBoolean,
  formatDoorState,
  formatMotion,
  formatLeak,
  formatCO2,
  formatDistance,
  formatCoordinate,
  formatSpeed,
  formatCount,
  // Field definitions
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

// Normalization
export {
  normalizeEmulatorDevice,
  normalizeDevices,
  getDeviceStatusLabel,
  getDeviceStatusColor,
  hasTelemetry,
} from "./normalizeDevice";
