/**
 * Widget Data Contract Types
 * 
 * Defines formal data contracts for widgets, specifying required fields,
 * fallback logic, system dependencies, and capability requirements.
 */

import type { DeviceCapability } from "@/lib/registry/capabilityRegistry";

/**
 * Data field definition with fallback behavior.
 */
export interface WidgetFieldContract {
  /** Field name (e.g., "temperature", "battery_level") */
  field: string;
  /** Is this field mandatory for the widget to function? */
  required: boolean;
  /** Default value if field is missing */
  fallbackValue?: unknown;
  /** Alternative data source field name */
  fallbackSource?: string;
  /** Validation function */
  validator?: (value: unknown) => boolean;
  /** Time in ms after which this field is considered stale */
  staleAfterMs?: number;
}

/**
 * Dependency on external system layer.
 */
export type PipelineLayer = 
  | 'sensor' 
  | 'gateway' 
  | 'ttn' 
  | 'decoder' 
  | 'webhook' 
  | 'database' 
  | 'external_api';

export interface WidgetDependency {
  /** Layer this widget depends on */
  layer: PipelineLayer;
  /** Is this dependency required for widget to function? */
  required: boolean;
  /** Human-readable description of why this dependency is needed */
  description?: string;
}

/**
 * Complete widget data contract.
 */
export interface WidgetDataContract {
  /** Widget identifier */
  widgetId: string;
  /** Schema version for migrations */
  version: string;
  /** Required capabilities for this widget to function */
  requiredCapabilities: DeviceCapability[];
  /** Optional capabilities that enhance functionality */
  optionalCapabilities?: DeviceCapability[];
  /** Field definitions */
  fields: WidgetFieldContract[];
  /** System dependencies */
  dependencies: WidgetDependency[];
  /** Minimum data points required (for charts) */
  minimumDataPoints?: number;
  /** Does this widget require a time range to be selected? */
  timeRangeRequired?: boolean;
}

/**
 * Get incompatibility reason for a widget given available capabilities.
 */
export function getWidgetIncompatibilityReason(
  contract: WidgetDataContract,
  availableCapabilities: DeviceCapability[]
): string | null {
  const missing = contract.requiredCapabilities.filter(
    cap => !availableCapabilities.includes(cap)
  );
  
  if (missing.length === 0) {
    return null;
  }
  
  return `Requires ${missing.join(', ')} capability${missing.length > 1 ? 'ies' : ''}`;
}

/**
 * Pre-defined widget contracts for common widget types.
 */
export const WIDGET_CONTRACTS: Record<string, WidgetDataContract> = {
  temperature_chart: {
    widgetId: 'temperature_chart',
    version: '1.0',
    requiredCapabilities: ['temperature'],
    optionalCapabilities: ['humidity'],
    fields: [
      { field: 'readings', required: true, validator: (v) => Array.isArray(v) && v.length > 0 },
      { field: 'sensor_id', required: true },
      { field: 'min', required: false },
      { field: 'max', required: false },
      { field: 'avg', required: false },
    ],
    dependencies: [
      { layer: 'sensor', required: true, description: 'Temperature sensor must be online' },
      { layer: 'gateway', required: true, description: 'Gateway must relay sensor data' },
      { layer: 'database', required: true, description: 'Readings must be stored' },
    ],
    minimumDataPoints: 2,
    timeRangeRequired: true,
  },
  
  current_temp: {
    widgetId: 'current_temp',
    version: '1.0',
    requiredCapabilities: ['temperature'],
    fields: [
      { field: 'current_value', required: true },
      { field: 'timestamp', required: true, staleAfterMs: 60 * 60 * 1000 }, // 1 hour
      { field: 'trend', required: false },
    ],
    dependencies: [
      { layer: 'sensor', required: true, description: 'Temperature sensor must be online' },
      { layer: 'gateway', required: true, description: 'Gateway must relay sensor data' },
    ],
  },
  
  battery_health: {
    widgetId: 'battery_health',
    version: '1.0',
    requiredCapabilities: ['battery'],
    fields: [
      { field: 'battery_level', required: true, validator: (v) => typeof v === 'number' && v >= 0 && v <= 100 },
      { field: 'last_seen', required: false },
      { field: 'forecast', required: false },
    ],
    dependencies: [
      { layer: 'sensor', required: true, description: 'Sensor must report battery level' },
    ],
  },
  
  door_activity: {
    widgetId: 'door_activity',
    version: '1.0',
    requiredCapabilities: ['door'],
    optionalCapabilities: ['battery'],
    fields: [
      { field: 'events', required: false },
      { field: 'sensor_id', required: true },
      { field: 'duration_stats', required: false },
    ],
    dependencies: [
      { layer: 'sensor', required: true, description: 'Door/contact sensor required' },
      { layer: 'gateway', required: true, description: 'Gateway must relay door events' },
    ],
  },
  
  external_weather: {
    widgetId: 'external_weather',
    version: '1.0',
    requiredCapabilities: [],
    fields: [
      { field: 'temperature', required: true },
      { field: 'condition', required: true },
      { field: 'humidity', required: false },
      { field: 'wind', required: false },
    ],
    dependencies: [
      { layer: 'external_api', required: true, description: 'Weather API must be reachable' },
    ],
  },
  
  gateway_health: {
    widgetId: 'gateway_health',
    version: '1.0',
    requiredCapabilities: [],
    fields: [
      { field: 'gateway_status', required: true },
      { field: 'last_seen', required: true, staleAfterMs: 30 * 60 * 1000 }, // 30 min
      { field: 'signal_quality', required: false },
    ],
    dependencies: [
      { layer: 'gateway', required: true, description: 'Gateway must be registered' },
      { layer: 'ttn', required: true, description: 'TTN must report gateway status' },
    ],
  },
  
  humidity_chart: {
    widgetId: 'humidity_chart',
    version: '1.0',
    requiredCapabilities: ['humidity'],
    optionalCapabilities: ['temperature'],
    fields: [
      { field: 'readings', required: true, validator: (v) => Array.isArray(v) && v.length > 0 },
      { field: 'sensor_id', required: true },
    ],
    dependencies: [
      { layer: 'sensor', required: true, description: 'Humidity sensor required' },
      { layer: 'gateway', required: true, description: 'Gateway must relay sensor data' },
      { layer: 'database', required: true, description: 'Readings must be stored' },
    ],
    minimumDataPoints: 2,
    timeRangeRequired: true,
  },
};

/**
 * Get the contract for a widget, or undefined if not defined.
 */
export function getWidgetContract(widgetId: string): WidgetDataContract | undefined {
  return WIDGET_CONTRACTS[widgetId];
}

/**
 * Check if a widget has all required fields.
 */
export function validateWidgetData(
  widgetId: string, 
  data: Record<string, unknown>
): { valid: boolean; missingFields: string[]; invalidFields: string[] } {
  const contract = getWidgetContract(widgetId);
  
  if (!contract) {
    return { valid: true, missingFields: [], invalidFields: [] };
  }
  
  const missingFields: string[] = [];
  const invalidFields: string[] = [];
  
  for (const field of contract.fields) {
    const value = data[field.field];
    
    if (field.required && (value === undefined || value === null)) {
      missingFields.push(field.field);
    }
    
    if (value !== undefined && value !== null && field.validator && !field.validator(value)) {
      invalidFields.push(field.field);
    }
  }
  
  return {
    valid: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields,
  };
}
