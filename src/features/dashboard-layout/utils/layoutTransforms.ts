/**
 * Layout Transform Utilities
 * 
 * Functions for validating, sanitizing, and migrating layout configurations.
 */

import type { LayoutConfig, WidgetPosition, SavedLayout, ActiveLayout, WidgetPreferences, TimelineState, EntityType } from "../types";
import { LAYOUT_CONFIG_VERSION, DEFAULT_LAYOUT_ID } from "../types";
import { WIDGET_REGISTRY, getMandatoryWidgets } from "../registry/widgetRegistry";
import { DEFAULT_TIMELINE_STATE, DEFAULT_WIDGET_PREFS, getDefaultLayout } from "../constants/defaultLayout";

// Re-export getDefaultLayout for convenience
export { getDefaultLayout };

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation result with detailed error information.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a layout configuration.
 * @param config - The layout configuration to validate
 * @param entityType - Optional entity type to validate mandatory widgets for specific entity
 */
export function validateLayoutConfig(config: unknown, entityType?: EntityType): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Type check
  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Layout config must be an object"], warnings: [] };
  }

  const cfg = config as Record<string, unknown>;

  // Version check
  if (typeof cfg.version !== "number") {
    warnings.push("Missing version field, assuming version 1");
  }

  // Widgets array check
  if (!Array.isArray(cfg.widgets)) {
    errors.push("Layout config must have a widgets array");
    return { valid: false, errors, warnings };
  }

  // Validate each widget position
  const seenIds = new Set<string>();
  for (const widget of cfg.widgets as unknown[]) {
    if (!isValidWidgetPosition(widget)) {
      errors.push(`Invalid widget position: ${JSON.stringify(widget)}`);
      continue;
    }

    const w = widget as WidgetPosition;
    
    // Check for duplicate IDs
    if (seenIds.has(w.i)) {
      errors.push(`Duplicate widget ID: ${w.i}`);
    }
    seenIds.add(w.i);

    // Check for unknown widget IDs
    if (!WIDGET_REGISTRY[w.i]) {
      warnings.push(`Unknown widget ID: ${w.i} (will be removed)`);
    }
  }

  // Check mandatory widgets are present (entity-type aware)
  const mandatory = getMandatoryWidgets(entityType);
  const hiddenWidgets = Array.isArray(cfg.hiddenWidgets) ? cfg.hiddenWidgets as string[] : [];
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[Layout] validateLayoutConfig:', {
      entityType: entityType || 'unspecified',
      widgetCount: (cfg.widgets as unknown[]).length,
      mandatoryRequired: mandatory.map(m => m.id),
    });
  }
  
  for (const mw of mandatory) {
    const inLayout = (cfg.widgets as WidgetPosition[]).some(w => w.i === mw.id);
    const isHidden = hiddenWidgets.includes(mw.id);
    
    if (!inLayout) {
      errors.push(`Mandatory widget missing from layout: ${mw.id}`);
    }
    if (isHidden) {
      errors.push(`Mandatory widget cannot be hidden: ${mw.id}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Type guard for WidgetPosition.
 */
function isValidWidgetPosition(obj: unknown): obj is WidgetPosition {
  if (!obj || typeof obj !== "object") return false;
  const w = obj as Record<string, unknown>;
  
  return (
    typeof w.i === "string" &&
    typeof w.x === "number" &&
    typeof w.y === "number" &&
    typeof w.w === "number" &&
    typeof w.h === "number" &&
    w.x >= 0 && w.x <= 11 &&
    w.y >= 0 &&
    w.w >= 1 && w.w <= 12 &&
    w.h >= 1
  );
}

// ============================================================================
// Sanitization
// ============================================================================

/**
 * Sanitize a layout config, fixing issues and applying defaults.
 * Returns a valid LayoutConfig or falls back to default.
 * @param config - The layout configuration to sanitize
 * @param entityType - Optional entity type for entity-specific mandatory widgets and defaults
 */
export function sanitizeLayoutConfig(config: unknown, entityType?: EntityType): LayoutConfig {
  const validation = validateLayoutConfig(config, entityType);
  
  // Get entity-specific default layout
  const defaultConfig = entityType 
    ? getDefaultLayout(entityType).config 
    : getDefaultLayout('unit').config;
  
  // If completely invalid, return entity-specific default
  if (!validation.valid && validation.errors.length > 0) {
    console.warn("[Layout] Invalid layout, falling back to default:", validation.errors);
    return { ...defaultConfig };
  }

  const cfg = config as Record<string, unknown>;
  const widgets = (cfg.widgets as WidgetPosition[]).filter(w => {
    // Remove unknown widgets
    if (!WIDGET_REGISTRY[w.i]) {
      console.warn(`[Layout] Removing unknown widget: ${w.i}`);
      return false;
    }
    return true;
  });

  // Ensure mandatory widgets are present (entity-type aware)
  const mandatory = getMandatoryWidgets(entityType);
  for (const mw of mandatory) {
    if (!widgets.some(w => w.i === mw.id)) {
      // Add mandatory widget at default position from entity-specific defaults
      const defaultPos = defaultConfig.widgets.find(w => w.i === mw.id);
      if (defaultPos) {
        widgets.push({ ...defaultPos });
        console.warn(`[Layout] Auto-repaired: Added missing mandatory widget: ${mw.id}`);
      }
    }
  }

  // Sanitize hidden widgets (remove mandatory widgets from hidden list)
  const hiddenWidgets = Array.isArray(cfg.hiddenWidgets)
    ? (cfg.hiddenWidgets as string[]).filter(id => {
        const widget = WIDGET_REGISTRY[id];
        if (!widget) return false;
        if (widget.mandatory) {
          console.warn(`[Layout] Removing mandatory widget from hidden list: ${id}`);
          return false;
        }
        return true;
      })
    : [];

  // Apply size constraints from registry
  const constrainedWidgets = widgets.map(w => constrainWidgetSize(w));

  // Fix overlapping widgets
  const fixedWidgets = fixOverlappingWidgets(constrainedWidgets);

  return {
    version: typeof cfg.version === "number" ? cfg.version : LAYOUT_CONFIG_VERSION,
    widgets: fixedWidgets,
    hiddenWidgets,
  };
}

/**
 * Apply size constraints from widget registry.
 */
function constrainWidgetSize(widget: WidgetPosition): WidgetPosition {
  const def = WIDGET_REGISTRY[widget.i];
  if (!def) return widget;

  return {
    ...widget,
    w: Math.max(def.minW, Math.min(def.maxW, widget.w)),
    h: Math.max(def.minH, Math.min(def.maxH, widget.h)),
    minW: def.minW,
    minH: def.minH,
    maxW: def.maxW,
    maxH: def.maxH,
  };
}

/**
 * Fix overlapping widgets by shifting them down.
 * Simple algorithm: sort by y, then x, and shift down if overlap detected.
 */
function fixOverlappingWidgets(widgets: WidgetPosition[]): WidgetPosition[] {
  // Sort by y position, then x
  const sorted = [...widgets].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  // Track occupied cells
  const occupied = new Set<string>();
  
  const result: WidgetPosition[] = [];
  
  for (const widget of sorted) {
    let { x, y, w, h } = widget;
    
    // Check if current position overlaps
    let hasOverlap = true;
    while (hasOverlap) {
      hasOverlap = false;
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const key = `${x + dx},${y + dy}`;
          if (occupied.has(key)) {
            hasOverlap = true;
            y++; // Shift down
            break;
          }
        }
        if (hasOverlap) break;
      }
    }
    
    // Mark cells as occupied
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        occupied.add(`${x + dx},${y + dy}`);
      }
    }
    
    result.push({ ...widget, x, y });
  }

  return result;
}

// ============================================================================
// Database Transform
// ============================================================================

/**
 * Transform a database row to ActiveLayout.
 * @param row - The saved layout from the database
 * @param entityType - Optional entity type for entity-specific validation and defaults
 */
export function dbRowToActiveLayout(row: SavedLayout, entityType?: EntityType): ActiveLayout {
  const sanitizedConfig = sanitizeLayoutConfig(row.layoutJson, entityType);
  
  return {
    id: row.id,
    name: row.name,
    isDefault: false,
    isImmutable: false,
    config: sanitizedConfig,
    widgetPrefs: row.widgetPrefsJson || DEFAULT_WIDGET_PREFS,
    timelineState: row.timelineStateJson || DEFAULT_TIMELINE_STATE,
    isDirty: false,
  };
}

/**
 * Transform ActiveLayout to database row format.
 */
export function activeLayoutToDbRow(
  layout: ActiveLayout,
  organizationId: string,
  sensorId: string,
  userId: string
): Omit<SavedLayout, "id" | "createdAt" | "updatedAt"> {
  return {
    organizationId,
    sensorId,
    userId,
    name: layout.name,
    isUserDefault: false,
    layoutJson: layout.config,
    widgetPrefsJson: layout.widgetPrefs,
    timelineStateJson: layout.timelineState,
    layoutVersion: 1,
  };
}

// ============================================================================
// Layout Comparison
// ============================================================================

/**
 * Check if two layout configs are equal.
 */
export function areLayoutConfigsEqual(a: LayoutConfig, b: LayoutConfig): boolean {
  if (a.version !== b.version) return false;
  if (a.widgets.length !== b.widgets.length) return false;
  if (a.hiddenWidgets.length !== b.hiddenWidgets.length) return false;

  // Compare widgets
  for (let i = 0; i < a.widgets.length; i++) {
    const wa = a.widgets[i];
    const wb = b.widgets[i];
    if (
      wa.i !== wb.i ||
      wa.x !== wb.x ||
      wa.y !== wb.y ||
      wa.w !== wb.w ||
      wa.h !== wb.h
    ) {
      return false;
    }
  }

  // Compare hidden widgets
  const hiddenA = new Set(a.hiddenWidgets);
  const hiddenB = new Set(b.hiddenWidgets);
  if (hiddenA.size !== hiddenB.size) return false;
  for (const id of hiddenA) {
    if (!hiddenB.has(id)) return false;
  }

  return true;
}

/**
 * Create a deep clone of a layout config.
 */
export function cloneLayoutConfig(config: LayoutConfig): LayoutConfig {
  return {
    version: config.version,
    widgets: config.widgets.map(w => ({ ...w })),
    hiddenWidgets: [...config.hiddenWidgets],
  };
}

/**
 * Create a new custom layout based on the default layout.
 */
export function createNewLayoutFromDefault(name: string): ActiveLayout {
  const defaultLayout = getDefaultLayout();
  
  return {
    id: "", // Will be assigned by database
    name,
    isDefault: false,
    isImmutable: false,
    config: cloneLayoutConfig(defaultLayout.config),
    widgetPrefs: { ...defaultLayout.widgetPrefs },
    timelineState: { ...defaultLayout.timelineState },
    isDirty: true,
  };
}
