/**
 * Dashboard Layout Types
 * 
 * Types for customizable unit dashboard layouts with drag-and-drop widgets.
 */

import type { ReactNode } from "react";

// ============================================================================
// Layout Configuration
// ============================================================================

/**
 * Position and size of a widget in the grid.
 * Uses react-grid-layout's coordinate system (12-column grid).
 */
export interface WidgetPosition {
  /** Unique widget identifier */
  i: string;
  /** X position (0-11) */
  x: number;
  /** Y position (row number) */
  y: number;
  /** Width in grid units (1-12) */
  w: number;
  /** Height in grid units */
  h: number;
  /** Minimum width (optional) */
  minW?: number;
  /** Minimum height (optional) */
  minH?: number;
  /** Maximum width (optional) */
  maxW?: number;
  /** Maximum height (optional) */
  maxH?: number;
  /** Whether widget is static (non-draggable/resizable) */
  static?: boolean;
}

/**
 * Widget visibility state in a layout.
 */
export interface WidgetVisibility {
  /** Widget ID */
  widgetId: string;
  /** Whether the widget is visible */
  visible: boolean;
}

/**
 * Complete layout configuration stored in the database.
 */
export interface LayoutConfig {
  /** Layout version for migrations */
  version: number;
  /** Widget positions array (react-grid-layout format) */
  widgets: WidgetPosition[];
  /** Hidden widgets (only non-mandatory can be hidden) */
  hiddenWidgets: string[];
}

/**
 * User preferences for individual widgets within a layout.
 */
export interface WidgetPreferences {
  [widgetId: string]: {
    /** Pinned data series for charts */
    pinnedSeries?: string[];
    /** Pinned location key */
    locationKey?: string;
    /** Custom widget settings */
    settings?: Record<string, unknown>;
  };
}

/**
 * Timeline state for time-series widgets.
 */
export interface TimelineState {
  /** Quick range selection */
  range: "1h" | "6h" | "24h" | "7d" | "30d" | "custom";
  /** Custom range start (ISO string) */
  customFrom?: string;
  /** Custom range end (ISO string) */
  customTo?: string;
  /** Comparison mode */
  compare: null | "previous_period" | { from: string; to: string };
  /** Zoom level (1 = default) */
  zoomLevel: number;
}

/**
 * Saved layout record from the database.
 */
export interface SavedLayout {
  /** Database ID */
  id: string;
  /** Organization ID */
  organizationId: string;
  /** Unit ID */
  unitId: string;
  /** Owner user ID */
  userId: string;
  /** Layout name */
  name: string;
  /** Whether this is the user's default for this unit */
  isUserDefault: boolean;
  /** Visibility level (for future sharing) */
  visibility: "private" | "org" | "public";
  /** Roles this layout is shared with */
  sharedWithRoles: string[];
  /** Layout configuration */
  layoutJson: LayoutConfig;
  /** Widget preferences */
  widgetPrefsJson: WidgetPreferences;
  /** Timeline state */
  timelineStateJson: TimelineState;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
}

/**
 * Active layout in the UI (can be saved or default).
 */
export interface ActiveLayout {
  /** Layout ID ("__default__" for default layout) */
  id: string;
  /** Display name */
  name: string;
  /** Whether this is the immutable default */
  isDefault: boolean;
  /** Whether this layout can be modified */
  isImmutable: boolean;
  /** Layout configuration */
  config: LayoutConfig;
  /** Widget preferences */
  widgetPrefs: WidgetPreferences;
  /** Timeline state */
  timelineState: TimelineState;
  /** Whether layout has unsaved changes */
  isDirty: boolean;
}

// ============================================================================
// Widget Registry
// ============================================================================

/**
 * Widget component props passed by the grid.
 */
export interface WidgetProps {
  /** Whether the dashboard is in customize mode */
  isCustomizing: boolean;
  /** Widget preferences from the active layout */
  preferences: WidgetPreferences[string] | undefined;
  /** Callback to update widget preferences */
  onPreferencesChange: (prefs: WidgetPreferences[string]) => void;
  /** Timeline state (for time-series widgets) */
  timelineState: TimelineState;
  /** Callback to update timeline state */
  onTimelineChange: (state: TimelineState) => void;
  /** Additional props passed from parent */
  [key: string]: unknown;
}

/**
 * Widget definition in the registry.
 */
export interface WidgetDefinition {
  /** Unique widget identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Whether this widget must always be visible */
  mandatory: boolean;
  /** Minimum width in grid units */
  minW: number;
  /** Minimum height in grid units */
  minH: number;
  /** Maximum width in grid units */
  maxW: number;
  /** Maximum height in grid units */
  maxH: number;
  /** Default width in grid units */
  defaultW: number;
  /** Default height in grid units */
  defaultH: number;
  /** Widget category for grouping */
  category: "monitoring" | "alerts" | "device" | "compliance";
  /** Icon name from lucide-react */
  icon: string;
  /** Whether this widget supports timeline controls */
  supportsTimeline: boolean;
}

// ============================================================================
// Layout Manager State
// ============================================================================

/**
 * Layout manager hook return type.
 */
export interface LayoutManagerState {
  /** Currently active layout */
  activeLayout: ActiveLayout;
  /** All available layouts (default + user's saved) */
  availableLayouts: Array<{ id: string; name: string; isDefault: boolean }>;
  /** Whether layouts are loading */
  isLoading: boolean;
  /** Current error */
  error: Error | null;
  /** Whether user can customize layouts */
  canCustomize: boolean;
  /** Number of saved layouts (excluding default) */
  savedLayoutCount: number;
  /** Maximum allowed saved layouts */
  maxLayouts: number;
}

/**
 * Layout manager actions.
 */
export interface LayoutManagerActions {
  /** Select a layout by ID */
  selectLayout: (layoutId: string) => void;
  /** Update widget positions */
  updatePositions: (positions: WidgetPosition[]) => void;
  /** Toggle widget visibility */
  toggleWidgetVisibility: (widgetId: string) => void;
  /** Update widget preferences */
  updateWidgetPrefs: (widgetId: string, prefs: WidgetPreferences[string]) => void;
  /** Update timeline state */
  updateTimelineState: (state: TimelineState) => void;
  /** Save current layout */
  saveLayout: (name?: string) => Promise<void>;
  /** Rename a layout */
  renameLayout: (layoutId: string, newName: string) => Promise<void>;
  /** Delete a layout */
  deleteLayout: (layoutId: string) => Promise<void>;
  /** Set a layout as user default */
  setAsDefault: (layoutId: string) => Promise<void>;
  /** Revert to default layout */
  revertToDefault: () => void;
  /** Discard unsaved changes */
  discardChanges: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Default layout ID (not stored in database) */
export const DEFAULT_LAYOUT_ID = "__default__";

/** Maximum number of custom layouts per user per unit */
export const MAX_CUSTOM_LAYOUTS = 3;

/** Current layout config version */
export const LAYOUT_CONFIG_VERSION = 1;

/** Grid configuration */
export const GRID_CONFIG = {
  /** Number of columns */
  cols: 12,
  /** Row height in pixels */
  rowHeight: 60,
  /** Margin between widgets [x, y] */
  margin: [16, 16] as [number, number],
  /** Container padding [x, y] */
  containerPadding: [0, 0] as [number, number],
} as const;
