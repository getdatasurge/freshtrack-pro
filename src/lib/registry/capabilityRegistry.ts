/**
 * Capability Registry
 * 
 * Defines device capabilities and provides utilities for capability-based
 * widget binding. Widgets declare requiredCapabilities instead of model lists.
 */

// ============================================================================
// CAPABILITY TYPES
// ============================================================================

/**
 * Standard device capabilities that sensors can provide.
 */
export type DeviceCapability = 
  | 'temperature'
  | 'humidity'
  | 'door'
  | 'motion'
  | 'leak'
  | 'co2'
  | 'tvoc'
  | 'pm'
  | 'gps'
  | 'pulse'
  | 'battery';

/**
 * All available capabilities as a const array.
 */
export const ALL_CAPABILITIES: DeviceCapability[] = [
  'temperature',
  'humidity',
  'door',
  'motion',
  'leak',
  'co2',
  'tvoc',
  'pm',
  'gps',
  'pulse',
  'battery',
];

// ============================================================================
// PAYLOAD TYPE → CAPABILITIES MAPPING
// ============================================================================

/**
 * Maps payload types to their provided capabilities.
 * This mirrors the manifests in supabase/functions/_shared/samples/
 */
export const PAYLOAD_TYPE_CAPABILITIES: Record<string, DeviceCapability[]> = {
  'door_v1': ['door', 'battery'],
  'temp_rh_v1': ['temperature', 'humidity', 'battery'],
  'temp_only_v1': ['temperature', 'battery'],
  'air_quality_co2_v1': ['co2', 'temperature', 'humidity', 'battery'],
  'air_quality_tvoc_v1': ['co2', 'tvoc', 'temperature', 'humidity', 'battery'],
  'leak_v1': ['leak', 'battery'],
  'motion_v1': ['motion', 'battery'],
  'gps_v1': ['gps', 'battery'],
  'metering_v1': ['pulse', 'battery'],
  'multi_door_temp_v1': ['door', 'temperature', 'humidity', 'battery'],
};

// ============================================================================
// LEGACY SENSOR TYPE → CAPABILITIES MAPPING
// ============================================================================

/**
 * Maps legacy sensor types (from DB) to capabilities.
 * Used during transition period and for backward compatibility.
 */
export const SENSOR_TYPE_CAPABILITIES: Record<string, DeviceCapability[]> = {
  'temperature': ['temperature', 'humidity', 'battery'],
  'door': ['door', 'battery'],
  'air_quality': ['co2', 'temperature', 'humidity', 'battery'],
  'leak': ['leak', 'battery'],
  'motion': ['motion', 'battery'],
  'gps': ['gps', 'battery'],
  'metering': ['pulse', 'battery'],
  'multi_sensor': ['door', 'temperature', 'humidity', 'battery'],
  'unknown': ['battery'],
};

// ============================================================================
// CAPABILITY UTILITIES
// ============================================================================

/**
 * Get capabilities for a payload type.
 */
export function getCapabilitiesForPayloadType(payloadType: string): DeviceCapability[] {
  return PAYLOAD_TYPE_CAPABILITIES[payloadType] ?? [];
}

/**
 * Get capabilities for a legacy sensor type.
 */
export function getCapabilitiesForSensorType(sensorType: string): DeviceCapability[] {
  return SENSOR_TYPE_CAPABILITIES[sensorType] ?? [];
}

/**
 * Check if a payload type has all required capabilities.
 */
export function payloadTypeHasCapabilities(
  payloadType: string,
  required: DeviceCapability[]
): boolean {
  const available = getCapabilitiesForPayloadType(payloadType);
  return required.every(cap => available.includes(cap));
}

/**
 * Check if a sensor type has all required capabilities.
 */
export function sensorTypeHasCapabilities(
  sensorType: string,
  required: DeviceCapability[]
): boolean {
  const available = getCapabilitiesForSensorType(sensorType);
  return required.every(cap => available.includes(cap));
}

/**
 * Check if capabilities array has all required capabilities.
 */
export function hasCapabilities(
  available: DeviceCapability[],
  required: DeviceCapability[]
): boolean {
  return required.every(cap => available.includes(cap));
}

/**
 * Get payload types that provide specific capabilities.
 */
export function getPayloadTypesWithCapabilities(
  required: DeviceCapability[]
): string[] {
  return Object.entries(PAYLOAD_TYPE_CAPABILITIES)
    .filter(([_, capabilities]) =>
      required.every(cap => capabilities.includes(cap))
    )
    .map(([type]) => type);
}

/**
 * Get sensor types that provide specific capabilities.
 */
export function getSensorTypesWithCapabilities(
  required: DeviceCapability[]
): string[] {
  return Object.entries(SENSOR_TYPE_CAPABILITIES)
    .filter(([_, capabilities]) =>
      required.every(cap => capabilities.includes(cap))
    )
    .map(([type]) => type);
}

// ============================================================================
// CAPABILITY METADATA
// ============================================================================

interface CapabilityInfo {
  id: DeviceCapability;
  displayName: string;
  description: string;
  icon: string;
  unit?: string;
}

/**
 * Metadata for each capability.
 */
export const CAPABILITY_INFO: Record<DeviceCapability, CapabilityInfo> = {
  temperature: {
    id: 'temperature',
    displayName: 'Temperature',
    description: 'Measures ambient temperature',
    icon: 'Thermometer',
    unit: '°C',
  },
  humidity: {
    id: 'humidity',
    displayName: 'Humidity',
    description: 'Measures relative humidity',
    icon: 'Droplets',
    unit: '%',
  },
  door: {
    id: 'door',
    displayName: 'Door/Contact',
    description: 'Detects open/close state',
    icon: 'DoorOpen',
  },
  motion: {
    id: 'motion',
    displayName: 'Motion',
    description: 'Detects movement/occupancy',
    icon: 'Activity',
  },
  leak: {
    id: 'leak',
    displayName: 'Leak Detection',
    description: 'Detects water/liquid presence',
    icon: 'Droplet',
  },
  co2: {
    id: 'co2',
    displayName: 'CO₂',
    description: 'Measures carbon dioxide levels',
    icon: 'Wind',
    unit: 'ppm',
  },
  tvoc: {
    id: 'tvoc',
    displayName: 'TVOC',
    description: 'Measures total volatile organic compounds',
    icon: 'Sparkles',
    unit: 'ppb',
  },
  pm: {
    id: 'pm',
    displayName: 'Particulate Matter',
    description: 'Measures air particles (PM2.5/PM10)',
    icon: 'Cloud',
    unit: 'µg/m³',
  },
  gps: {
    id: 'gps',
    displayName: 'GPS Location',
    description: 'Provides geographic coordinates',
    icon: 'MapPin',
  },
  pulse: {
    id: 'pulse',
    displayName: 'Pulse Counter',
    description: 'Counts pulses/events',
    icon: 'Hash',
    unit: 'count',
  },
  battery: {
    id: 'battery',
    displayName: 'Battery',
    description: 'Reports battery level',
    icon: 'Battery',
    unit: '%',
  },
};

/**
 * Get display info for a capability.
 */
export function getCapabilityInfo(capability: DeviceCapability): CapabilityInfo {
  return CAPABILITY_INFO[capability];
}

/**
 * Get display names for multiple capabilities.
 */
export function getCapabilityDisplayNames(capabilities: DeviceCapability[]): string[] {
  return capabilities.map(cap => CAPABILITY_INFO[cap]?.displayName ?? cap);
}
