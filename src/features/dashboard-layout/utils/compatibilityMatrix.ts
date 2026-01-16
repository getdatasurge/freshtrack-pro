/**
 * Compatibility Matrix Utilities
 * 
 * Provides capability-based widget compatibility checking.
 * Determines which widgets work with which sensor types based on capabilities.
 */

import type { DeviceCapability } from "@/lib/registry/capabilityRegistry";
import { getCapabilitiesForSensorType, hasCapabilities, getCapabilityDisplayNames } from "@/lib/registry/capabilityRegistry";
import { WIDGET_REGISTRY, getWidgetsForEntity } from "../registry/widgetRegistry";
import type { WidgetDefinition, EntityType } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export interface CompatibilityResult {
  /** Widget is fully compatible */
  compatible: boolean;
  /** Widget is partially compatible (missing optional capabilities) */
  partial: boolean;
  /** Human-readable reason for incompatibility */
  reason: string | null;
  /** Missing required capabilities */
  missingRequired: DeviceCapability[];
  /** Missing optional capabilities */
  missingOptional: DeviceCapability[];
}

export interface WidgetCompatibilityInfo {
  widget: WidgetDefinition;
  result: CompatibilityResult;
}

// ============================================================================
// COMPATIBILITY CHECKING
// ============================================================================

/**
 * Check if a widget is compatible with available capabilities.
 */
export function checkWidgetCompatibility(
  widgetId: string,
  availableCapabilities: DeviceCapability[]
): CompatibilityResult {
  const widget = WIDGET_REGISTRY[widgetId];
  
  if (!widget) {
    return {
      compatible: false,
      partial: false,
      reason: `Unknown widget: ${widgetId}`,
      missingRequired: [],
      missingOptional: [],
    };
  }
  
  const required = widget.requiredCapabilities ?? [];
  const optional = widget.optionalCapabilities ?? [];
  
  // If no required capabilities, widget is always compatible
  if (required.length === 0) {
    return {
      compatible: true,
      partial: false,
      reason: null,
      missingRequired: [],
      missingOptional: [],
    };
  }
  
  // Check for missing required capabilities
  const missingRequired = required.filter(cap => !availableCapabilities.includes(cap));
  const missingOptional = optional.filter(cap => !availableCapabilities.includes(cap));
  
  if (missingRequired.length > 0) {
    const missingNames = getCapabilityDisplayNames(missingRequired);
    return {
      compatible: false,
      partial: false,
      reason: `Requires ${missingNames.join(', ')} capability${missingRequired.length > 1 ? 'ies' : ''}`,
      missingRequired,
      missingOptional,
    };
  }
  
  // All required present, check if partially compatible
  const isPartial = missingOptional.length > 0;
  
  return {
    compatible: true,
    partial: isPartial,
    reason: isPartial 
      ? `Limited functionality: missing ${getCapabilityDisplayNames(missingOptional).join(', ')}`
      : null,
    missingRequired: [],
    missingOptional,
  };
}

/**
 * Check widget compatibility using sensor type (legacy support).
 */
export function checkWidgetCompatibilityBySensorType(
  widgetId: string,
  sensorType?: string
): CompatibilityResult {
  if (!sensorType) {
    // No sensor assigned - check if widget requires any capabilities
    const widget = WIDGET_REGISTRY[widgetId];
    const required = widget?.requiredCapabilities ?? [];
    
    if (required.length === 0) {
      return {
        compatible: true,
        partial: false,
        reason: null,
        missingRequired: [],
        missingOptional: [],
      };
    }
    
    return {
      compatible: false,
      partial: false,
      reason: 'No sensor assigned',
      missingRequired: required,
      missingOptional: widget?.optionalCapabilities ?? [],
    };
  }
  
  const capabilities = getCapabilitiesForSensorType(sensorType);
  return checkWidgetCompatibility(widgetId, capabilities);
}

// ============================================================================
// WIDGET FILTERING
// ============================================================================

/**
 * Get all compatible widgets for available capabilities.
 */
export function getCompatibleWidgets(
  availableCapabilities: DeviceCapability[],
  entityType: EntityType
): WidgetDefinition[] {
  const widgets = getWidgetsForEntity(entityType);
  return widgets.filter(widget => {
    const result = checkWidgetCompatibility(widget.id, availableCapabilities);
    return result.compatible;
  });
}

/**
 * Get all incompatible widgets with reasons.
 */
export function getIncompatibleWidgets(
  availableCapabilities: DeviceCapability[],
  entityType: EntityType
): WidgetCompatibilityInfo[] {
  const widgets = getWidgetsForEntity(entityType);
  return widgets
    .map(widget => ({
      widget,
      result: checkWidgetCompatibility(widget.id, availableCapabilities),
    }))
    .filter(info => !info.result.compatible);
}

/**
 * Get all widgets with their compatibility status.
 */
export function getWidgetsWithCompatibility(
  availableCapabilities: DeviceCapability[],
  entityType: EntityType
): WidgetCompatibilityInfo[] {
  const widgets = getWidgetsForEntity(entityType);
  return widgets.map(widget => ({
    widget,
    result: checkWidgetCompatibility(widget.id, availableCapabilities),
  }));
}

// ============================================================================
// COMPATIBILITY MATRIX GENERATION
// ============================================================================

/**
 * Generate full compatibility matrix for all widgets and payload types.
 * Useful for documentation and debugging.
 */
export function generateCompatibilityMatrix(
  payloadTypes: Record<string, DeviceCapability[]>,
  entityType: EntityType
): Record<string, Record<string, CompatibilityResult>> {
  const widgets = getWidgetsForEntity(entityType);
  const matrix: Record<string, Record<string, CompatibilityResult>> = {};
  
  for (const widget of widgets) {
    matrix[widget.id] = {};
    for (const [payloadType, capabilities] of Object.entries(payloadTypes)) {
      matrix[widget.id][payloadType] = checkWidgetCompatibility(widget.id, capabilities);
    }
  }
  
  return matrix;
}

/**
 * Generate summary of widget requirements.
 */
export function getWidgetRequirementsSummary(widgetId: string): {
  required: DeviceCapability[];
  optional: DeviceCapability[];
  compatibleSensorTypes: string[];
} {
  const widget = WIDGET_REGISTRY[widgetId];
  
  if (!widget) {
    return { required: [], optional: [], compatibleSensorTypes: [] };
  }
  
  const required = widget.requiredCapabilities ?? [];
  const optional = widget.optionalCapabilities ?? [];
  
  // Find compatible sensor types from SENSOR_TYPE_CAPABILITIES
  const { SENSOR_TYPE_CAPABILITIES } = require("@/lib/registry/capabilityRegistry");
  const compatibleSensorTypes = Object.entries(SENSOR_TYPE_CAPABILITIES)
    .filter(([_, caps]) => hasCapabilities(caps as DeviceCapability[], required))
    .map(([type]) => type);
  
  return { required, optional, compatibleSensorTypes };
}
