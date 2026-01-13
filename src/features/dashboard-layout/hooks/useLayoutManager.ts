import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  ActiveLayout,
  LayoutConfig,
  WidgetPosition,
  TimelineState,
  LayoutManagerState,
  LayoutManagerActions,
} from "../types";
import { DEFAULT_LAYOUT_ID } from "../types";
import { useEntityLayoutStorage, EntityType } from "./useEntityLayoutStorage";
import {
  getDefaultLayout,
  dbRowToActiveLayout,
  areLayoutConfigsEqual,
  cloneLayoutConfig,
} from "../utils/layoutTransforms";

/**
 * Hook for managing entity (unit/site) dashboard layouts.
 */
export function useLayoutManager(
  entityType: EntityType,
  entityId: string | undefined,
  organizationId: string | undefined
): { state: LayoutManagerState; actions: LayoutManagerActions } {
  const storage = useEntityLayoutStorage(entityType, entityId, organizationId);

  const [activeLayout, setActiveLayout] = useState<ActiveLayout>(() => getDefaultLayout());
  const [originalConfig, setOriginalConfig] = useState<LayoutConfig | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);

  const isDirty = useMemo(() => {
    if (activeLayout.isDefault) return false;
    if (!originalConfig) return false;
    return !areLayoutConfigsEqual(activeLayout.config, originalConfig);
  }, [activeLayout, originalConfig]);

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

  const availableLayouts = useMemo(() => {
    const layouts: Array<{ id: string; name: string; isDefault: boolean; isUserDefault: boolean }> = [
      { id: DEFAULT_LAYOUT_ID, name: "Default", isDefault: true, isUserDefault: false },
    ];
    storage.savedLayouts.forEach((l) => {
      layouts.push({ id: l.id, name: l.name, isDefault: false, isUserDefault: l.isUserDefault });
    });
    return layouts;
  }, [storage.savedLayouts]);

  const selectLayout = useCallback((layoutId: string) => {
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
  }, [storage.savedLayouts]);

  const updatePositions = useCallback((positions: WidgetPosition[]) => {
    setActiveLayout((prev) => ({ ...prev, config: { ...prev.config, widgets: positions } }));
  }, []);

  const toggleWidgetVisibility = useCallback((widgetId: string) => {
    setActiveLayout((prev) => {
      const hiddenWidgets = prev.config.hiddenWidgets || [];
      const isHidden = hiddenWidgets.includes(widgetId);
      return {
        ...prev,
        config: {
          ...prev.config,
          hiddenWidgets: isHidden ? hiddenWidgets.filter((id) => id !== widgetId) : [...hiddenWidgets, widgetId],
        },
      };
    });
  }, []);

  const updateTimelineState = useCallback((timelineState: TimelineState) => {
    setActiveLayout((prev) => ({ ...prev, timelineState }));
  }, []);

  const saveLayout = useCallback(async (name?: string) => {
    const nextSlot = storage.nextAvailableSlot();
    if (activeLayout.isDefault && nextSlot) {
      const saved = await storage.saveLayout({
        slotNumber: nextSlot,
        name: name || `Layout ${nextSlot}`,
        layoutJson: activeLayout.config,
        timelineStateJson: activeLayout.timelineState,
        widgetPrefsJson: activeLayout.widgetPrefs,
      });
      const active = dbRowToActiveLayout(saved);
      setActiveLayout(active);
      setOriginalConfig(cloneLayoutConfig(active.config));
      return saved;
    } else if (activeLayout.id) {
      const saved = await storage.updateLayout({
        layoutId: activeLayout.id,
        name: name || activeLayout.name,
        layoutJson: activeLayout.config,
        timelineStateJson: activeLayout.timelineState,
        widgetPrefsJson: activeLayout.widgetPrefs,
      });
      setOriginalConfig(cloneLayoutConfig(activeLayout.config));
      return saved;
    }
    return null;
  }, [activeLayout, storage]);

  const renameLayout = useCallback(async (newName: string) => {
    if (!activeLayout.id || activeLayout.isDefault) return;
    await storage.updateLayout({ layoutId: activeLayout.id, name: newName });
    setActiveLayout((prev) => ({ ...prev, name: newName }));
  }, [activeLayout, storage]);

  const deleteLayout = useCallback(async () => {
    if (!activeLayout.id || activeLayout.isDefault) return;
    await storage.deleteLayout(activeLayout.id);
    setActiveLayout(getDefaultLayout());
    setOriginalConfig(null);
    setIsCustomizing(false);
  }, [activeLayout, storage]);

  const setAsUserDefault = useCallback(async () => {
    if (!activeLayout.id || activeLayout.isDefault) return;
    await storage.setAsUserDefault(activeLayout.id);
  }, [activeLayout, storage]);

  const revertToDefault = useCallback(() => {
    const defaultLayout = getDefaultLayout();
    setActiveLayout((prev) => ({ ...prev, config: cloneLayoutConfig(defaultLayout.config) }));
  }, []);

  const discardChanges = useCallback(() => {
    if (originalConfig) {
      setActiveLayout((prev) => ({ ...prev, config: cloneLayoutConfig(originalConfig) }));
    }
    setIsCustomizing(false);
  }, [originalConfig]);

  const createNewLayout = useCallback(async (name: string) => {
    const nextSlot = storage.nextAvailableSlot();
    if (!nextSlot) throw new Error("Maximum layouts reached");
    const saved = await storage.saveLayout({
      slotNumber: nextSlot,
      name,
      layoutJson: activeLayout.config,
      timelineStateJson: activeLayout.timelineState,
      widgetPrefsJson: activeLayout.widgetPrefs,
    });
    const active = dbRowToActiveLayout(saved);
    setActiveLayout(active);
    setOriginalConfig(cloneLayoutConfig(active.config));
    return saved;
  }, [activeLayout, storage]);

  return {
    state: {
      activeLayout,
      availableLayouts,
      isLoading: storage.isLoading,
      isSaving: storage.isSaving || storage.isUpdating,
      isDirty,
      isCustomizing,
      canCreateNew: storage.canCreateNew,
      layoutCount: storage.layoutCount,
    },
    actions: {
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
    },
  };
}
