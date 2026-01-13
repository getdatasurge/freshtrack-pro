/**
 * Widget Registry
 * 
 * Defines all available widgets for the unit dashboard with their
 * size constraints, categories, and capabilities.
 */

import {
  LineChart,
  Thermometer,
  Activity,
  AlertTriangle,
  Gauge,
  Hash,
  CheckCircle2,
  ShieldCheck,
  Radio,
  Battery,
} from "lucide-react";
import type { WidgetDefinition } from "../types";

/**
 * Complete registry of all dashboard widgets.
 * 
 * Widget Categories:
 * - monitoring: Real-time data display (chart, current temp)
 * - alerts: Alert-related widgets (banner, thresholds)
 * - device: Device/sensor status widgets
 * - compliance: Compliance and logging widgets
 */
export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  // =========================================================================
  // MANDATORY WIDGETS (cannot be hidden)
  // =========================================================================
  
  temperature_chart: {
    id: "temperature_chart",
    name: "Temperature History",
    description: "Interactive chart showing temperature readings over time with zoom and comparison features.",
    mandatory: true,
    minW: 4,
    minH: 4,
    maxW: 12,
    maxH: 12,
    defaultW: 8,
    defaultH: 6,
    category: "monitoring",
    icon: LineChart,
    supportsTimeline: true,
  },
  
  current_temp: {
    id: "current_temp",
    name: "Current Temperature",
    description: "Displays the current temperature reading with status indicator.",
    mandatory: true,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 4,
    defaultH: 2,
    category: "monitoring",
    icon: Thermometer,
    supportsTimeline: false,
  },
  
  device_status: {
    id: "device_status",
    name: "Device Status",
    description: "Shows the current device connection status and health.",
    mandatory: true,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 4,
    defaultH: 2,
    category: "device",
    icon: Activity,
    supportsTimeline: false,
  },
  
  // =========================================================================
  // OPTIONAL WIDGETS (can be hidden in custom layouts)
  // =========================================================================
  
  alerts_banner: {
    id: "alerts_banner",
    name: "Active Alerts",
    description: "Banner showing any active alerts for this unit.",
    mandatory: false,
    minW: 6,
    minH: 1,
    maxW: 12,
    maxH: 3,
    defaultW: 12,
    defaultH: 2,
    category: "alerts",
    icon: AlertTriangle,
    supportsTimeline: false,
  },
  
  temp_limits: {
    id: "temp_limits",
    name: "Temperature Limits",
    description: "Displays configured temperature thresholds (high/low alarm and warning limits).",
    mandatory: false,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 4,
    defaultH: 2,
    category: "alerts",
    icon: Gauge,
    supportsTimeline: false,
  },
  
  readings_count: {
    id: "readings_count",
    name: "Readings Count",
    description: "Shows the number of readings received in the selected time period.",
    mandatory: false,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 4,
    defaultH: 2,
    category: "monitoring",
    icon: Hash,
    supportsTimeline: true,
  },
  
  device_readiness: {
    id: "device_readiness",
    name: "Device Readiness",
    description: "Checklist showing device configuration and connectivity status.",
    mandatory: false,
    minW: 3,
    minH: 3,
    maxW: 8,
    maxH: 6,
    defaultW: 4,
    defaultH: 4,
    category: "device",
    icon: CheckCircle2,
    supportsTimeline: false,
  },
  
  last_known_good: {
    id: "last_known_good",
    name: "Last Known Good",
    description: "Shows the last time temperature was within safe limits.",
    mandatory: false,
    minW: 3,
    minH: 3,
    maxW: 8,
    maxH: 6,
    defaultW: 4,
    defaultH: 4,
    category: "compliance",
    icon: ShieldCheck,
    supportsTimeline: false,
  },
  
  connected_sensors: {
    id: "connected_sensors",
    name: "Connected Sensors",
    description: "List of sensors assigned to this unit with their status.",
    mandatory: false,
    minW: 4,
    minH: 2,
    maxW: 12,
    maxH: 6,
    defaultW: 6,
    defaultH: 3,
    category: "device",
    icon: Radio,
    supportsTimeline: false,
  },
  
  battery_health: {
    id: "battery_health",
    name: "Battery Health",
    description: "Battery level and health forecast for connected sensors.",
    mandatory: false,
    minW: 4,
    minH: 2,
    maxW: 12,
    maxH: 6,
    defaultW: 6,
    defaultH: 3,
    category: "device",
    icon: Battery,
    supportsTimeline: false,
  },
};

/**
 * Get all widget definitions as an array.
 */
export function getAllWidgets(): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY);
}

/**
 * Get only mandatory widgets.
 */
export function getMandatoryWidgets(): WidgetDefinition[] {
  return getAllWidgets().filter(w => w.mandatory);
}

/**
 * Get only optional widgets.
 */
export function getOptionalWidgets(): WidgetDefinition[] {
  return getAllWidgets().filter(w => !w.mandatory);
}

/**
 * Get widgets by category.
 */
export function getWidgetsByCategory(category: WidgetDefinition["category"]): WidgetDefinition[] {
  return getAllWidgets().filter(w => w.category === category);
}

/**
 * Get widgets that support timeline controls.
 */
export function getTimelineWidgets(): WidgetDefinition[] {
  return getAllWidgets().filter(w => w.supportsTimeline);
}

/**
 * Check if a widget can be hidden (only non-mandatory widgets).
 */
export function canHideWidget(widgetId: string): boolean {
  const widget = WIDGET_REGISTRY[widgetId];
  return widget ? !widget.mandatory : false;
}

/**
 * Validate that all mandatory widgets are present in a layout.
 */
export function validateMandatoryWidgets(visibleWidgetIds: string[]): {
  valid: boolean;
  missingWidgets: string[];
} {
  const mandatory = getMandatoryWidgets();
  const missingWidgets = mandatory
    .filter(w => !visibleWidgetIds.includes(w.id))
    .map(w => w.id);
  
  return {
    valid: missingWidgets.length === 0,
    missingWidgets,
  };
}

/**
 * Get widget IDs in display order (mandatory first, then by category).
 */
export function getWidgetIdsInOrder(): string[] {
  const mandatory = getMandatoryWidgets().map(w => w.id);
  const optional = getOptionalWidgets().map(w => w.id);
  return [...mandatory, ...optional];
}
