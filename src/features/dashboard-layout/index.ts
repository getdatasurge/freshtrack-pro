/**
 * Dashboard Layout Feature Module
 * 
 * Provides customizable drag-and-drop layouts for the unit dashboard.
 */

// Types
export * from "./types";

// Constants
export { 
  DEFAULT_UNIT_DASHBOARD_LAYOUT,
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_TIMELINE_STATE,
  DEFAULT_WIDGET_PREFS,
  getDefaultLayout,
  getDefaultWidgetPositions,
} from "./constants/defaultLayout";

// Widget Registry
export {
  WIDGET_REGISTRY,
  getAllWidgets,
  getMandatoryWidgets,
  getOptionalWidgets,
  getWidgetsByCategory,
  getTimelineWidgets,
  canHideWidget,
  validateMandatoryWidgets,
  getWidgetIdsInOrder,
} from "./registry/widgetRegistry";

// Utilities
export {
  validateLayoutConfig,
  sanitizeLayoutConfig,
  dbRowToActiveLayout,
  activeLayoutToDbRow,
  areLayoutConfigsEqual,
  cloneLayoutConfig,
  createNewLayoutFromDefault,
  type ValidationResult,
} from "./utils/layoutTransforms";
