import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  ActiveLayout,
  LayoutConfig,
  WidgetPosition,
  TimelineState,
  LayoutManagerState,
  LayoutManagerActions,
  SavedLayout,
} from "../types";
import { DEFAULT_LAYOUT_ID } from "../types";
import { useLayoutStorage } from "./useLayoutStorage";
import {
  getDefaultLayout,
  dbRowToActiveLayout,
  areLayoutConfigsEqual,
  createNewLayoutFromDefault,
  cloneLayoutConfig,
} from "../utils/layoutTransforms";

/**
 * Hook for managing sensor dashboard layouts.
 * Layouts are now scoped per sensor.
 */
export function useLayoutManager(
  sensorId: string | undefined,
  organizationId: string | undefined
): { state: LayoutManagerState; actions: LayoutManagerActions } {
  const storage = useLayoutStorage(sensorId, organizationId);

  // Active layout state
  const [activeLayout, setActiveLayout] = useState<ActiveLayout>(() => getDefaultLayout());
  const [originalConfig, setOriginalConfig] = useState<LayoutConfig | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Compute dirty state
  const isDirty = useMemo(() => {
    if (activeLayout.isDefault) return false;
    if (!originalConfig) return false;
    return !areLayoutConfigsEqual(activeLayout.config, originalConfig);
  }, [activeLayout, originalConfig]);

  // Initialize with user's default layout or fallback
  useEffect(() => {
    if (!storage.isLoading && storage.savedLayouts) {
      const userDefault = storage.savedLayouts.find((l) => l.isUserDefault);
      if (userDefault) {
        const active = dbRowToActiveLayout(userDefault);
        setActiveLayout(active);
        setOriginalConfig(cloneLayoutConfig(active.config));
      } else {
        setActiveLayout(getDefaultLayout());
        setOriginalConfig(null);
      }
    }
  }, [storage.isLoading, storage.savedLayouts]);

  // Available layouts for selector
  const availableLayouts = useMemo(() => {
    const layouts: Array<{ id: string; name: string; isDefault: boolean; isUserDefault: boolean }> = [
      { id: DEFAULT_LAYOUT_ID, name: "Default (Recommended)", isDefault: true, isUserDefault: false },
    ];
    storage.savedLayouts.forEach((l) => {
      layouts.push({
        id: l.id,
        name: l.name,
        isDefault: false,
        isUserDefault: l.isUserDefault,
      });
    });
    return layouts;
  }, [storage.savedLayouts]);

  // Select a layout by ID
  const selectLayout = useCallback(
    (layoutId: string) => {
      if (layoutId === DEFAULT_LAYOUT_ID) {
        setActiveLayout(getDefaultLayout());
        setOriginalConfig(null);
        setIsCustomizing(false);
      } else {
        const saved = storage.savedLayouts.find((l) => l.id === layoutId);
        if (saved) {
          const active = dbRowToActiveLayout(saved);
          setActiveLayout(active);
          setOriginalConfig(cloneLayoutConfig(active.config));
          setIsCustomizing(false);
        }
      }
    },
    [storage.savedLayouts]
  );

  // Update widget positions
  const updatePositions = useCallback((positions: WidgetPosition[]) => {
    setActiveLayout((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        widgets: positions,
      },
    }));
  }, []);

  // Toggle widget visibility
  const toggleWidgetVisibility = useCallback((widgetId: string) => {
    setActiveLayout((prev) => {
      const hiddenWidgets = prev.config.hiddenWidgets || [];
      const isHidden = hiddenWidgets.includes(widgetId);
      return {
        ...prev,
        config: {
          ...prev.config,
          hiddenWidgets: isHidden
            ? hiddenWidgets.filter((id) => id !== widgetId)
            : [...hiddenWidgets, widgetId],
        },
      };
    });
  }, []);

  // Update timeline state
  const updateTimelineState = useCallback((timelineState: TimelineState) => {
    setActiveLayout((prev) => ({
      ...prev,
      timelineState,
    }));
  }, []);

  // Save current layout (create new or update existing)
  const saveLayout = useCallback(
    async (name?: string) => {
      if (activeLayout.isDefault) {
        // Create new from default
        const newName = name || "My Layout";
        const saved = await storage.saveLayout({
          name: newName,
          layoutJson: activeLayout.config,
          timelineStateJson: activeLayout.timelineState,
          widgetPrefsJson: activeLayout.widgetPrefs,
        });
        const active = dbRowToActiveLayout(saved);
        setActiveLayout(active);
        setOriginalConfig(cloneLayoutConfig(active.config));
        return saved;
      } else if (activeLayout.id) {
        // Update existing
        const saved = await storage.updateLayout({
          id: activeLayout.id,
          name: name || activeLayout.name,
          layoutJson: activeLayout.config,
          timelineStateJson: activeLayout.timelineState,
          widgetPrefsJson: activeLayout.widgetPrefs,
        });
        setOriginalConfig(cloneLayoutConfig(activeLayout.config));
        return saved;
      }
      return null;
    },
    [activeLayout, storage]
  );

  // Rename current layout
  const renameLayout = useCallback(
    async (newName: string) => {
      if (!activeLayout.id || activeLayout.isDefault) return;
      await storage.updateLayout({
        id: activeLayout.id,
        name: newName,
      });
      setActiveLayout((prev) => ({ ...prev, name: newName }));
    },
    [activeLayout, storage]
  );

  // Delete current layout
  const deleteLayout = useCallback(async () => {
    if (!activeLayout.id || activeLayout.isDefault) return;
    await storage.deleteLayout(activeLayout.id);
    setActiveLayout(getDefaultLayout());
    setOriginalConfig(null);
    setIsCustomizing(false);
  }, [activeLayout, storage]);

  // Set current layout as user default
  const setAsUserDefault = useCallback(async () => {
    if (!activeLayout.id || activeLayout.isDefault) return;
    await storage.setAsUserDefault(activeLayout.id);
    setActiveLayout((prev) => ({ ...prev, isUserDefault: true }));
  }, [activeLayout, storage]);

  // Revert to default layout config
  const revertToDefault = useCallback(() => {
    const defaultLayout = getDefaultLayout();
    setActiveLayout((prev) => ({
      ...prev,
      config: cloneLayoutConfig(defaultLayout.config),
    }));
  }, []);

  // Discard unsaved changes
  const discardChanges = useCallback(() => {
    if (originalConfig) {
      setActiveLayout((prev) => ({
        ...prev,
        config: cloneLayoutConfig(originalConfig),
      }));
    }
    setIsCustomizing(false);
  }, [originalConfig]);

  // Create new layout from current
  const createNewLayout = useCallback(
    async (name: string) => {
      const saved = await storage.saveLayout({
        name,
        layoutJson: activeLayout.config,
        timelineStateJson: activeLayout.timelineState,
        widgetPrefsJson: activeLayout.widgetPrefs,
      });
      const active = dbRowToActiveLayout(saved);
      setActiveLayout(active);
      setOriginalConfig(cloneLayoutConfig(active.config));
      return saved;
    },
    [activeLayout, storage]
  );

  const state: LayoutManagerState = {
    activeLayout,
    availableLayouts,
    isLoading: storage.isLoading,
    isSaving: storage.isSaving || storage.isUpdating,
    isDirty,
    isCustomizing,
    canCreateNew: storage.canCreateNew,
    layoutCount: storage.layoutCount,
  };

  const actions: LayoutManagerActions = {
    selectLayout,
    updatePositions,
    toggleWidgetVisibility,
    updateTimelineState,
    saveLayout,
    renameLayout,
    deleteLayout,
    setAsUserDefault,
    revertToDefault,
    discardChanges,
    createNewLayout,
    setIsCustomizing,
  };

  return { state, actions };
}
