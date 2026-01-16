/**
 * Layout Validation Hook
 * 
 * Validates layout configuration before saving, checking for:
 * - Missing mandatory widgets
 * - Widget data binding issues (capability-based validation)
 * - Missing required data sources
 */

import { useMemo } from "react";
import { WIDGET_REGISTRY, getMandatoryWidgets } from "../registry/widgetRegistry";
import type { LayoutConfig } from "../types";
import type { EntityType } from "../hooks/useEntityLayoutStorage";
import type { DeviceCapability } from "@/lib/registry/capabilityRegistry";
import { 
  checkWidgetCompatibility, 
  checkWidgetCompatibilityBySensorType,
  type CompatibilityResult 
} from "../utils/compatibilityMatrix";

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  id: string;
  widgetId: string;
  widgetName: string;
  severity: ValidationSeverity;
  message: string;
  action?: {
    label: string;
    href?: string;
  };
}

export interface LayoutValidationResult {
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

/**
 * Extended validation context with capability support.
 */
interface ValidationContext {
  // Capability-based validation (preferred)
  unitCapabilities?: DeviceCapability[];
  payloadType?: string;
  bindingConfidence?: number;
  
  // Legacy support
  hasSensor: boolean;
  sensorType?: string;
  
  // Other context
  hasLocationConfigured: boolean;
  hasManualLoggingEnabled: boolean;
}

/**
 * Convert capability compatibility result to validation issue.
 */
function capabilityResultToIssue(
  widgetId: string,
  widgetName: string,
  result: CompatibilityResult
): ValidationIssue | null {
  if (result.compatible && !result.partial) {
    return null;
  }
  
  if (!result.compatible) {
    return {
      id: `capability-${widgetId}`,
      widgetId,
      widgetName,
      severity: "warning",
      message: result.reason ?? "Missing required capabilities",
      action: { label: "Configure Sensor", href: "#sensors" },
    };
  }
  
  // Partial compatibility
  if (result.partial && result.reason) {
    return {
      id: `capability-partial-${widgetId}`,
      widgetId,
      widgetName,
      severity: "info",
      message: result.reason,
    };
  }
  
  return null;
}

/**
 * Validate widget using capability-based approach.
 */
function validateWidgetCapabilities(
  widgetId: string,
  context: ValidationContext
): ValidationIssue | null {
  const widgetDef = WIDGET_REGISTRY[widgetId];
  if (!widgetDef) return null;
  
  // If widget has no capability requirements, skip validation
  if (!widgetDef.requiredCapabilities || widgetDef.requiredCapabilities.length === 0) {
    return null;
  }
  
  // Use capability-based validation if capabilities are available
  if (context.unitCapabilities && context.unitCapabilities.length > 0) {
    const result = checkWidgetCompatibility(widgetId, context.unitCapabilities);
    return capabilityResultToIssue(widgetId, widgetDef.name, result);
  }
  
  // Fallback to sensor type-based validation
  if (context.sensorType) {
    const result = checkWidgetCompatibilityBySensorType(widgetId, context.sensorType);
    return capabilityResultToIssue(widgetId, widgetDef.name, result);
  }
  
  // No sensor assigned at all
  if (!context.hasSensor) {
    return {
      id: `no-sensor-${widgetId}`,
      widgetId,
      widgetName: widgetDef.name,
      severity: "warning",
      message: "No sensor assigned to this unit",
      action: { label: "Assign Sensor", href: "#sensors" },
    };
  }
  
  return null;
}

/**
 * Legacy validation for non-capability requirements (weather, manual log).
 */
function validateLegacyDataSource(
  widgetId: string,
  context: ValidationContext
): ValidationIssue | null {
  const widgetDef = WIDGET_REGISTRY[widgetId];
  if (!widgetDef?.requiredDataSource) return null;

  const { type, message } = widgetDef.requiredDataSource;

  switch (type) {
    case "weather":
      if (!context.hasLocationConfigured) {
        return {
          id: `binding-${widgetId}-location`,
          widgetId,
          widgetName: widgetDef.name,
          severity: "warning",
          message: message || "Requires site location to be configured",
          action: { label: "Set Location" },
        };
      }
      break;

    case "manual_log":
      if (!context.hasManualLoggingEnabled) {
        return {
          id: `binding-${widgetId}-manual`,
          widgetId,
          widgetName: widgetDef.name,
          severity: "info",
          message: message || "Works best with manual logging enabled",
        };
      }
      break;

    case "gateway":
    case "none":
      // No validation needed
      break;
      
    case "sensor":
      // Handled by capability validation
      break;
  }

  return null;
}

/**
 * Hook for validating layout configuration.
 * Uses capability-based validation when available, falls back to legacy sensor type.
 */
export function useLayoutValidation(
  config: LayoutConfig,
  entityType: EntityType,
  context: {
    hasSensor?: boolean;
    sensorType?: string;
    unitCapabilities?: DeviceCapability[];
    payloadType?: string;
    bindingConfidence?: number;
    hasLocationConfigured?: boolean;
  } = {}
): LayoutValidationResult {
  return useMemo(() => {
    const issues: ValidationIssue[] = [];

    // Build validation context
    const validationContext: ValidationContext = {
      hasSensor: context.hasSensor ?? false,
      sensorType: context.sensorType,
      unitCapabilities: context.unitCapabilities,
      payloadType: context.payloadType,
      bindingConfidence: context.bindingConfidence,
      hasLocationConfigured: context.hasLocationConfigured ?? false,
      hasManualLoggingEnabled: true, // Assume enabled for now
    };

    // 1. Check for missing mandatory widgets
    const mandatoryWidgets = getMandatoryWidgets(entityType);
    const visibleWidgetIds = new Set(config.widgets.map((w) => w.i));
    const hiddenWidgetIds = new Set(config.hiddenWidgets || []);

    for (const widget of mandatoryWidgets) {
      const isVisible = visibleWidgetIds.has(widget.id);
      const isHidden = hiddenWidgetIds.has(widget.id);

      if (!isVisible && !isHidden) {
        // Widget is completely missing from config
        issues.push({
          id: `missing-${widget.id}`,
          widgetId: widget.id,
          widgetName: widget.name,
          severity: "error",
          message: `Required widget "${widget.name}" is missing from layout`,
        });
      }
    }

    // 2. Check widget capabilities for all visible widgets
    for (const widgetPos of config.widgets) {
      // Capability-based validation (primary)
      const capabilityIssue = validateWidgetCapabilities(widgetPos.i, validationContext);
      if (capabilityIssue) {
        issues.push(capabilityIssue);
      }
      
      // Legacy validation for non-sensor requirements
      const legacyIssue = validateLegacyDataSource(widgetPos.i, validationContext);
      if (legacyIssue) {
        // Don't duplicate issues
        const isDuplicate = issues.some(i => i.widgetId === legacyIssue.widgetId && i.id !== legacyIssue.id);
        if (!isDuplicate) {
          issues.push(legacyIssue);
        }
      }
    }

    // Calculate counts
    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;

    return {
      isValid: errorCount === 0,
      hasErrors: errorCount > 0,
      hasWarnings: warningCount > 0,
      issues,
      errorCount,
      warningCount,
    };
  }, [
    config, 
    entityType, 
    context.hasSensor, 
    context.sensorType, 
    context.unitCapabilities,
    context.payloadType,
    context.bindingConfidence,
    context.hasLocationConfigured,
  ]);
}

/**
 * Check if a specific widget can be added to layout based on capabilities.
 */
export function canAddWidget(
  widgetId: string,
  unitCapabilities?: DeviceCapability[],
  sensorType?: string
): { canAdd: boolean; reason: string | null } {
  if (unitCapabilities && unitCapabilities.length > 0) {
    const result = checkWidgetCompatibility(widgetId, unitCapabilities);
    return {
      canAdd: result.compatible,
      reason: result.reason,
    };
  }
  
  if (sensorType) {
    const result = checkWidgetCompatibilityBySensorType(widgetId, sensorType);
    return {
      canAdd: result.compatible,
      reason: result.reason,
    };
  }
  
  // No sensor info - check if widget requires capabilities
  const widget = WIDGET_REGISTRY[widgetId];
  if (widget?.requiredCapabilities && widget.requiredCapabilities.length > 0) {
    return {
      canAdd: false,
      reason: "No sensor assigned",
    };
  }
  
  return { canAdd: true, reason: null };
}
