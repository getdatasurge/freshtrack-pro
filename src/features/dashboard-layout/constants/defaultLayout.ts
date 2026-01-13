/**
 * Default Dashboard Layouts
 * 
 * Immutable, static layouts that:
 * - Are always available
 * - Cannot be edited, resized, or deleted
 * - Serve as fallback if custom layouts fail to load
 * - Are NOT stored in the database
 */

import type { LayoutConfig, ActiveLayout, TimelineState, WidgetPreferences, EntityType } from "../types";
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

// ============================================================================
// UNIT LAYOUTS
// ============================================================================

/**
 * The default unit layout configuration.
 * 
 * Grid layout:
 * - 12 columns
 * - Row 0-1: Alerts Banner (full width, 2 rows)
 * - Row 2-7: Temperature Chart (8 cols) + Stats Cards (4 cols stacked)
 * - Row 8-11: Device Readiness (4 cols) + Last Known Good (4 cols) + empty
 * - Row 12-14: Connected Sensors (6 cols) + Battery Health (6 cols)
 */
export const DEFAULT_UNIT_LAYOUT_CONFIG: LayoutConfig = {
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
 * Empty unit layout for new custom layouts.
 * Only includes mandatory widgets.
 */
export const EMPTY_UNIT_LAYOUT_CONFIG: LayoutConfig = {
  version: LAYOUT_CONFIG_VERSION,
  widgets: [
    // Only mandatory widgets for new layouts
    { i: "temperature_chart", x: 0, y: 0, w: 8, h: 6, minW: 4, minH: 4, maxW: 12, maxH: 12 },
    { i: "current_temp", x: 8, y: 0, w: 4, h: 2, minW: 2, minH: 2, maxW: 6, maxH: 4 },
    { i: "device_status", x: 8, y: 2, w: 4, h: 2, minW: 2, minH: 2, maxW: 6, maxH: 4 },
  ],
  hiddenWidgets: [],
};

// ============================================================================
// SITE LAYOUTS
// ============================================================================

/**
 * The default site layout configuration.
 * 
 * Grid layout:
 * - 12 columns
 * - Row 0-2: Site Overview (full width, 3 rows)
 * - Row 3-8: Units Status Grid (8 cols) + Alerts + Compliance (4 cols stacked)
 */
export const DEFAULT_SITE_LAYOUT_CONFIG: LayoutConfig = {
  version: LAYOUT_CONFIG_VERSION,
  widgets: [
    // Site Overview - full width header (MANDATORY for sites)
    { i: "site_overview", x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2, maxW: 12, maxH: 4 },
    
    // Units Status Grid - main focus (MANDATORY for sites)
    { i: "units_status_grid", x: 0, y: 3, w: 8, h: 6, minW: 4, minH: 4, maxW: 12, maxH: 12 },
    
    // Site Alerts Summary - right side
    { i: "site_alerts_summary", x: 8, y: 3, w: 4, h: 3, minW: 3, minH: 2, maxW: 8, maxH: 6 },
    
    // Compliance Summary - right side bottom
    { i: "compliance_summary", x: 8, y: 6, w: 4, h: 3, minW: 3, minH: 2, maxW: 8, maxH: 6 },
  ],
  hiddenWidgets: [],
};

/**
 * Empty site layout for new custom layouts.
 * Only includes mandatory widgets.
 */
export const EMPTY_SITE_LAYOUT_CONFIG: LayoutConfig = {
  version: LAYOUT_CONFIG_VERSION,
  widgets: [
    // Only mandatory widgets for new layouts
    { i: "site_overview", x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2, maxW: 12, maxH: 4 },
    { i: "units_status_grid", x: 0, y: 3, w: 8, h: 6, minW: 4, minH: 4, maxW: 12, maxH: 12 },
  ],
  hiddenWidgets: [],
};

// ============================================================================
// LAYOUT CONSTRUCTORS
// ============================================================================

/**
 * The complete default unit layout object.
 */
export const DEFAULT_UNIT_DASHBOARD_LAYOUT: ActiveLayout = {
  id: DEFAULT_LAYOUT_ID,
  name: "Default",
  isDefault: true,
  isImmutable: true,
  config: DEFAULT_UNIT_LAYOUT_CONFIG,
  widgetPrefs: DEFAULT_WIDGET_PREFS,
  timelineState: DEFAULT_TIMELINE_STATE,
  isDirty: false,
};

/**
 * The complete default site layout object.
 */
export const DEFAULT_SITE_DASHBOARD_LAYOUT: ActiveLayout = {
  id: DEFAULT_LAYOUT_ID,
  name: "Default",
  isDefault: true,
  isImmutable: true,
  config: DEFAULT_SITE_LAYOUT_CONFIG,
  widgetPrefs: DEFAULT_WIDGET_PREFS,
  timelineState: DEFAULT_TIMELINE_STATE,
  isDirty: false,
};

// Keep backwards compatibility alias
export const DEFAULT_LAYOUT_CONFIG = DEFAULT_UNIT_LAYOUT_CONFIG;

/**
 * Get the default layout for an entity type.
 */
export function getDefaultLayout(entityType: EntityType = 'unit'): ActiveLayout {
  const baseLayout = entityType === 'site' 
    ? DEFAULT_SITE_DASHBOARD_LAYOUT 
    : DEFAULT_UNIT_DASHBOARD_LAYOUT;
  
  return {
    ...baseLayout,
    config: {
      ...baseLayout.config,
      widgets: baseLayout.config.widgets.map(w => ({ ...w })),
      hiddenWidgets: [...baseLayout.config.hiddenWidgets],
    },
    widgetPrefs: { ...DEFAULT_WIDGET_PREFS },
    timelineState: { ...DEFAULT_TIMELINE_STATE },
  };
}

/**
 * Get the empty layout for new custom layouts.
 */
export function getEmptyLayout(entityType: EntityType = 'unit'): ActiveLayout {
  const config = entityType === 'site' 
    ? EMPTY_SITE_LAYOUT_CONFIG 
    : EMPTY_UNIT_LAYOUT_CONFIG;
  
  return {
    id: '', // Will be set when saved
    name: '',
    isDefault: false,
    isImmutable: false,
    config: {
      ...config,
      widgets: config.widgets.map(w => ({ ...w })),
      hiddenWidgets: [...config.hiddenWidgets],
    },
    widgetPrefs: { ...DEFAULT_WIDGET_PREFS },
    timelineState: { ...DEFAULT_TIMELINE_STATE },
    isDirty: false,
  };
}

/**
 * Get widget positions from the default layout for react-grid-layout.
 */
export function getDefaultWidgetPositions(entityType: EntityType = 'unit') {
  const config = entityType === 'site' 
    ? DEFAULT_SITE_LAYOUT_CONFIG 
    : DEFAULT_UNIT_LAYOUT_CONFIG;
  return config.widgets.map(w => ({ ...w }));
}
