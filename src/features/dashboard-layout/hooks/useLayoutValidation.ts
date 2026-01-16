/**
 * Layout Validation Hook
 * 
 * Validates layout configuration before saving, checking for:
 * - Missing mandatory widgets
 * - Widget data binding issues (e.g., door_activity without door sensor)
 * - Missing required data sources
 */

import { useMemo } from "react";
import { WIDGET_REGISTRY, getMandatoryWidgets } from "../registry/widgetRegistry";
import type { LayoutConfig } from "../types";
import type { EntityType } from "../hooks/useEntityLayoutStorage";

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

interface ValidationContext {
  hasSensor: boolean;
  sensorType?: string;
  hasDoorSensor: boolean;
  hasHumiditySensor: boolean;
  hasLocationConfigured: boolean;
  hasManualLoggingEnabled: boolean;
}

/**
 * Check if a widget's required data source is available
 */
function validateWidgetDataBinding(
  widgetId: string,
  context: ValidationContext
): ValidationIssue | null {
  const widgetDef = WIDGET_REGISTRY[widgetId];
  if (!widgetDef?.requiredDataSource) return null;

  const { type, sensorTypes, message } = widgetDef.requiredDataSource;

  switch (type) {
    case "sensor":
      if (!context.hasSensor) {
        return {
          id: `binding-${widgetId}`,
          widgetId,
          widgetName: widgetDef.name,
          severity: "warning",
          message: message || "Requires a sensor to be assigned",
          action: { label: "Assign Sensor", href: "#sensors" },
        };
      }
      // Check specific sensor types
      if (sensorTypes?.includes("door") && !context.hasDoorSensor) {
        return {
          id: `binding-${widgetId}-door`,
          widgetId,
          widgetName: widgetDef.name,
          severity: "warning",
          message: message || "Requires a door/contact sensor",
          action: { label: "Configure Sensor", href: "#sensors" },
        };
      }
      if (sensorTypes?.includes("humidity") && !context.hasHumiditySensor) {
        return {
          id: `binding-${widgetId}-humidity`,
          widgetId,
          widgetName: widgetDef.name,
          severity: "warning",
          message: message || "Requires a sensor that reports humidity",
          action: { label: "Check Sensor", href: "#sensors" },
        };
      }
      break;

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
      // Gateway widgets don't need specific validation currently
      break;

    case "none":
      // No data source required
      break;
  }

  return null;
}

export function useLayoutValidation(
  config: LayoutConfig,
  entityType: EntityType,
  context: {
    hasSensor?: boolean;
    sensorType?: string;
    hasLocationConfigured?: boolean;
  } = {}
): LayoutValidationResult {
  return useMemo(() => {
    const issues: ValidationIssue[] = [];

    // Build validation context
    const validationContext: ValidationContext = {
      hasSensor: context.hasSensor ?? false,
      sensorType: context.sensorType,
      hasDoorSensor: context.sensorType === "door" || context.sensorType === "contact",
      hasHumiditySensor: context.sensorType === "humidity" || context.sensorType === "temperature_humidity",
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

    // 2. Check widget data bindings for all visible widgets
    for (const widgetPos of config.widgets) {
      const bindingIssue = validateWidgetDataBinding(widgetPos.i, validationContext);
      if (bindingIssue) {
        issues.push(bindingIssue);
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
  }, [config, entityType, context.hasSensor, context.sensorType, context.hasLocationConfigured]);
}
