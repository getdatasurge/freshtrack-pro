/**
 * Dashboard Layout Types
 * 
 * Types for customizable unit/site dashboard layouts with drag-and-drop widgets.
 */

import type { LucideIcon } from "lucide-react";
import type { DeviceCapability } from "@/lib/registry/capabilityRegistry";
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
 * Entity type for dashboard scoping
 */
export type EntityType = 'unit' | 'site';

/**
 * Preview modes for layout customization.
 * Allows users to see how the dashboard looks in different data states.
 */
export type PreviewMode = "live" | "no_data" | "offline" | "alerting" | "normal";

/**
 * Saved layout record from the database.
 * Note: sensorId is deprecated - use entityType + entityId instead.
 */
export interface SavedLayout {
  /** Database ID */
  id: string;
  /** Organization ID */
  organizationId: string;
  /** @deprecated Use entityType + entityId instead */
  sensorId: string;
  /** Entity type (unit or site) */
  entityType?: EntityType;
  /** Entity ID (unit ID or site ID) */
  entityId?: string;
  /** Owner user ID */
  userId: string;
  /** Layout name */
  name: string;
  /** Whether this is the user's default for this entity */
  isUserDefault: boolean;
  /** Layout configuration */
  layoutJson: LayoutConfig;
  /** Widget preferences */
  widgetPrefsJson: WidgetPreferences;
  /** Timeline state */
  timelineStateJson: TimelineState;
  /** Layout version for migrations */
  layoutVersion: number;
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
// Widget Data Types
// ============================================================================

/**
 * Unit data passed to unit widgets.
 */
export interface WidgetUnit {
  id: string;
  name: string;
  unit_type: string;
  temp_limit_high: number;
  temp_limit_low: number | null;
  last_temp_reading: number | null;
  last_reading_at: string | null;
  door_state?: "open" | "closed" | "unknown" | null;
  door_last_changed_at?: string | null;
}

/**
 * Site data passed to site widgets.
 */
export interface WidgetSite {
  id: string;
  name: string;
  organization_id: string;
  timezone?: string;
  latitude?: number | null;
  longitude?: number | null;
  compliance_mode?: string;
  manual_log_cadence_seconds?: number;
  corrective_action_required?: boolean;
}

/**
 * Sensor data passed to widgets.
 */
export interface WidgetSensor {
  id: string;
  name: string;
  dev_eui?: string;
  last_seen_at: string | null;
  battery_level: number | null;
  signal_strength: number | null;
  status: string;
  sensor_type: string;
  is_primary?: boolean;
}

/**
 * Device info for device readiness widgets.
 */
export interface WidgetDevice {
  id: string;
  unit_id: string | null;
  last_seen_at: string | null;
  serial_number: string | null;
  battery_level: number | null;
  signal_strength: number | null;
  status: string;
}

/**
 * Derived status passed to widgets.
 */
export interface WidgetDerivedStatus {
  isOnline: boolean;
  status: string;
  statusLabel: string;
  statusColor: string;
  statusBgColor: string;
  offlineSeverity: "none" | "warning" | "critical";
  missedCheckins: number;
  lastSeenAt: string | null;
  lastReadingAt: string | null;
}

/**
 * Last known good reading data.
 */
export interface WidgetLastKnownGood {
  temp: number | null;
  at: string | null;
  source: "sensor" | "manual" | null;
}

/**
 * Alert data for widgets.
 */
export interface WidgetAlert {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  clearCondition: string;
}

/**
 * Area data for site widgets.
 */
export interface WidgetArea {
  id: string;
  name: string;
  description?: string | null;
  unitsCount?: number;
}

/**
 * Sensor reading for chart widgets.
 */
export interface WidgetReading {
  id: string;
  temperature: number;
  humidity: number | null;
  recorded_at: string;
}

// ============================================================================
// Widget Registry
// ============================================================================

/**
 * Widget component props passed by the grid.
 */
export interface WidgetProps {
  /** Entity type */
  entityType?: EntityType;
  /** Entity ID (unit or site ID) */
  entityId?: string;
  /** Organization ID */
  organizationId?: string;
  /** Site ID (for unit widgets) */
  siteId?: string;
  /** Whether the dashboard is in customize mode */
  isCustomizing?: boolean;
  /** Widget preferences from the active layout */
  preferences?: WidgetPreferences[string];
  /** Callback to update widget preferences */
  onPreferencesChange?: (prefs: WidgetPreferences[string]) => void;
  /** Timeline state (for time-series widgets) */
  timelineState?: TimelineState;
  /** Callback to update timeline state */
  onTimelineChange?: (state: TimelineState) => void;
  /** Unit data (for unit widgets) */
  unit?: WidgetUnit;
  /** Site data (for site widgets) */
  site?: WidgetSite;
  /** Primary sensor data */
  sensor?: WidgetSensor;
  /** All LoRa sensors for the unit */
  loraSensors?: WidgetSensor[];
  /** Device data */
  device?: WidgetDevice;
  /** Derived status */
  derivedStatus?: WidgetDerivedStatus;
  /** Last known good reading */
  lastKnownGood?: WidgetLastKnownGood;
  /** Active alerts */
  alerts?: WidgetAlert[];
  /** Sensor readings */
  readings?: WidgetReading[];
  /** Comparison readings for chart overlay */
  comparisonReadings?: WidgetReading[];
  /** Areas (for site widgets) */
  areas?: WidgetArea[];
  /** Total unit count (for site widgets) */
  totalUnits?: number;
  /** Callback for logging temperature */
  onLogTemp?: () => void;
  /** ID of the widget that was just added (for auto-prompt flows) */
  recentlyAddedWidgetId?: string;
  /** Callback to clear the recently added widget ID after handling */
  onClearRecentlyAdded?: () => void;
  /** Callback to refetch site data after location changes */
  onSiteLocationChange?: () => void;
  /** Refresh tick counter - increments on realtime events to trigger widget re-fetches */
  refreshTick?: number;
}

/**
 * Data source category for a widget.
 */
export type WidgetDataCategory =
  | "sensor"      // Data from LoRa sensors
  | "gateway"     // Data from LoRa gateways
  | "system"      // System-generated data (alerts, events)
  | "calculated"  // Derived/computed metrics
  | "manual"      // User-entered data
  | "external";   // External APIs (weather)

/**
 * Sensor types for data binding validation.
 */
export type SensorTypeRequirement = "temperature" | "door" | "humidity" | "motion";

/**
 * Required data source for a widget.
 */
export interface WidgetRequiredDataSource {
  /** Type of data source required */
  type: "sensor" | "gateway" | "manual_log" | "weather" | "none";
  /** Specific sensor types required (only for type: 'sensor') */
  sensorTypes?: SensorTypeRequirement[];
  /** Message to show when data source is missing */
  message: string;
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
  category: "monitoring" | "alerts" | "device" | "compliance" | "utility";
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Whether this widget supports timeline controls */
  supportsTimeline: boolean;
  /** Entity types this widget is available for (undefined = all) */
  entityTypes?: EntityType[];
  /** Data source category for the widget */
  dataCategory?: WidgetDataCategory;
  /** Required data source for the widget (for validation) - DEPRECATED: use requiredCapabilities */
  requiredDataSource?: WidgetRequiredDataSource;
  /** Required capabilities for this widget to function (capability-based validation) */
  requiredCapabilities?: DeviceCapability[];
  /** Optional capabilities that enhance widget functionality */
  optionalCapabilities?: DeviceCapability[];
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
  /** List of available layouts (default + saved) */
  availableLayouts: Array<{ id: string; name: string; isDefault: boolean; isUserDefault: boolean }>;
  /** Loading state */
  isLoading: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Whether layout has unsaved changes */
  isDirty: boolean;
  /** Whether currently in customize mode */
  isCustomizing: boolean;
  /** Whether user can create more layouts */
  canCreateNew: boolean;
  /** Number of saved layouts */
  layoutCount: number;
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
  /** Update timeline state */
  updateTimelineState: (state: TimelineState) => void;
  /** Save current layout (create if default, update if custom) */
  saveLayout: (name?: string) => Promise<SavedLayout | null>;
  /** Rename current layout */
  renameLayout: (newName: string) => Promise<void>;
  /** Delete current layout */
  deleteLayout: () => Promise<void>;
  /** Set current layout as user default */
  setAsUserDefault: () => Promise<void>;
  /** Revert to default layout */
  revertToDefault: () => void;
  /** Discard unsaved changes */
  discardChanges: () => void;
  /** Create new layout from current */
  createNewLayout: (name: string) => Promise<SavedLayout>;
  /** Set customizing mode */
  setIsCustomizing: (value: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Default layout ID (not stored in database) */
export const DEFAULT_LAYOUT_ID = "__default__";

/** Maximum number of custom layouts per user per entity */
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
