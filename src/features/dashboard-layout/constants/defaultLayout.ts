/**
 * Default Unit Dashboard Layout
 * 
 * This is the immutable, static layout that:
 * - Is always available
 * - Cannot be edited, resized, or deleted
 * - Serves as fallback if custom layouts fail to load
 * - Is NOT stored in the database
 */

import type { LayoutConfig, ActiveLayout, TimelineState, WidgetPreferences } from "../types";
import { DEFAULT_LAYOUT_ID, LAYOUT_CONFIG_VERSION } from "../types";

/**
 * Default timeline state for new layouts.
 */
export const DEFAULT_TIMELINE_STATE: TimelineState = {
  range: "24h",
  compare: null,
  zoomLevel: 1,
};

/**
 * Default widget preferences (empty).
 */
export const DEFAULT_WIDGET_PREFS: WidgetPreferences = {};

/**
 * The default layout configuration.
 * 
 * Grid layout:
 * - 12 columns
 * - Row 0-1: Alerts Banner (full width, 2 rows)
 * - Row 2-7: Temperature Chart (8 cols) + Stats Cards (4 cols stacked)
 * - Row 8-11: Device Readiness (4 cols) + Last Known Good (4 cols) + empty
 * - Row 12-14: Connected Sensors (6 cols) + Battery Health (6 cols)
 */
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  version: LAYOUT_CONFIG_VERSION,
  widgets: [
    // Alerts Banner - full width at top
    { i: "alerts_banner", x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 1 },
    
    // Temperature Chart - main focus (MANDATORY)
    { i: "temperature_chart", x: 0, y: 2, w: 8, h: 6, minW: 4, minH: 4, maxW: 12, maxH: 12 },
    
    // Current Temperature - top right (MANDATORY)
    { i: "current_temp", x: 8, y: 2, w: 4, h: 2, minW: 2, minH: 2, maxW: 6, maxH: 4 },
    
    // Device Status - right side (MANDATORY)
    { i: "device_status", x: 8, y: 4, w: 4, h: 2, minW: 2, minH: 2, maxW: 6, maxH: 4 },
    
    // Temperature Limits - right side
    { i: "temp_limits", x: 8, y: 6, w: 4, h: 2, minW: 2, minH: 2, maxW: 6, maxH: 4 },
    
    // Readings Count - right side bottom
    { i: "readings_count", x: 8, y: 8, w: 4, h: 2, minW: 2, minH: 2, maxW: 6, maxH: 4 },
    
    // Device Readiness - bottom left
    { i: "device_readiness", x: 0, y: 8, w: 4, h: 4, minW: 3, minH: 3, maxW: 8, maxH: 6 },
    
    // Last Known Good - bottom center
    { i: "last_known_good", x: 4, y: 8, w: 4, h: 4, minW: 3, minH: 3, maxW: 8, maxH: 6 },
    
    // Connected Sensors - bottom
    { i: "connected_sensors", x: 0, y: 12, w: 6, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 6 },
    
    // Battery Health - bottom right
    { i: "battery_health", x: 6, y: 12, w: 6, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 6 },
  ],
  hiddenWidgets: [],
};

/**
 * The complete default layout object.
 * 
 * This layout:
 * - Has the special ID "__default__"
 * - Is marked as immutable (cannot be modified)
 * - Is always the first option in layout selector
 * - Serves as the fallback for any layout loading errors
 */
export const DEFAULT_UNIT_DASHBOARD_LAYOUT: ActiveLayout = {
  id: DEFAULT_LAYOUT_ID,
  name: "Default (Recommended)",
  isDefault: true,
  isImmutable: true,
  config: DEFAULT_LAYOUT_CONFIG,
  widgetPrefs: DEFAULT_WIDGET_PREFS,
  timelineState: DEFAULT_TIMELINE_STATE,
  isDirty: false,
};

/**
 * Get a fresh copy of the default layout.
 * Always returns a new object to prevent accidental mutations.
 */
export function getDefaultLayout(): ActiveLayout {
  return {
    ...DEFAULT_UNIT_DASHBOARD_LAYOUT,
    config: {
      ...DEFAULT_LAYOUT_CONFIG,
      widgets: DEFAULT_LAYOUT_CONFIG.widgets.map(w => ({ ...w })),
      hiddenWidgets: [...DEFAULT_LAYOUT_CONFIG.hiddenWidgets],
    },
    widgetPrefs: { ...DEFAULT_WIDGET_PREFS },
    timelineState: { ...DEFAULT_TIMELINE_STATE },
  };
}

/**
 * Get widget positions from the default layout for react-grid-layout.
 */
export function getDefaultWidgetPositions() {
  return DEFAULT_LAYOUT_CONFIG.widgets.map(w => ({ ...w }));
}
