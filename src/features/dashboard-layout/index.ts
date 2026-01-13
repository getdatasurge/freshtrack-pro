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

// Hooks
export { useLayoutStorage } from "./hooks/useLayoutStorage";
export { useLayoutManager } from "./hooks/useLayoutManager";
export { useTimelineState } from "./hooks/useTimelineState";

// Components
export { LayoutSelector } from "./components/LayoutSelector";
export { LayoutManager } from "./components/LayoutManager";
export { CustomizeToggle } from "./components/CustomizeToggle";
export { GridCanvas } from "./components/GridCanvas";
export { WidgetWrapper } from "./components/WidgetWrapper";
export { WidgetRenderer } from "./components/WidgetRenderer";
export { HiddenWidgetsPanel } from "./components/HiddenWidgetsPanel";
export { TimelineControls } from "./components/TimelineControls";
