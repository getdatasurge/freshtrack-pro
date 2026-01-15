import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { useDraftLayout } from "./useDraftLayout";
import {
  getDefaultLayout,
  dbRowToActiveLayout,
  areLayoutConfigsEqual,
  cloneLayoutConfig,
} from "../utils/layoutTransforms";
import { toast } from "sonner";

// Session storage helpers to persist active layout selection across navigation
function getLastActiveLayoutId(entityType: string, entityId: string): string | null {
  try {
    return sessionStorage.getItem(`layout-active-${entityType}-${entityId}`);
  } catch {
    return null;
  }
}

function setLastActiveLayoutId(entityType: string, entityId: string, layoutId: string): void {
  try {
    sessionStorage.setItem(`layout-active-${entityType}-${entityId}`, layoutId);
  } catch {
    // Ignore storage errors
  }
}

function clearLastActiveLayoutId(entityType: string, entityId: string): void {
  try {
    sessionStorage.removeItem(`layout-active-${entityType}-${entityId}`);
  } catch {
    // Ignore storage errors
  }
}

// Extended state to include draft-related properties
interface ExtendedLayoutManagerState extends LayoutManagerState {
  hasDraft: boolean;
  draftUpdatedAt: Date | null;
}

// Extended actions to include draft-related methods
interface ExtendedLayoutManagerActions extends LayoutManagerActions {
  saveDraftLocally: () => void;
  clearLocalDraft: () => void;
  applyDraft: () => void;
}

/**
 * Hook for managing entity (unit/site) dashboard layouts.
 * Now with local draft persistence (no auto-save to DB).
 */
export function useLayoutManager(
  entityType: EntityType,
  entityId: string | undefined,
  organizationId: string | undefined,
  userId?: string
): { state: ExtendedLayoutManagerState; actions: ExtendedLayoutManagerActions } {
  const storage = useEntityLayoutStorage(entityType, entityId, organizationId);

  const [activeLayout, setActiveLayout] = useState<ActiveLayout>(() => {
    try {
      return getDefaultLayout(entityType);
    } catch (error) {
      console.error("[useLayoutManager] Failed to get default layout:", error);
      // Return a minimal safe default that matches ActiveLayout interface
      return {
        id: DEFAULT_LAYOUT_ID,
        name: "Default",
        isDefault: true,
        isImmutable: true,
        isDirty: false,
        config: { version: 1, widgets: [], hiddenWidgets: [] },
        timelineState: { range: "24h", compare: null, zoomLevel: 1 },
        widgetPrefs: {},
      };
    }
  });
  const [originalConfig, setOriginalConfig] = useState<LayoutConfig | null>(null);
  const [originalTimelineState, setOriginalTimelineState] = useState<TimelineState | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);
  
  // Track if we've applied the draft
  const draftAppliedRef = useRef(false);
  // Track if initial load has completed to prevent post-save overwrites
  const initialLoadDoneRef = useRef(false);

  // Reset initial load guard when entity changes
  useEffect(() => {
    initialLoadDoneRef.current = false;
    draftAppliedRef.current = false;
  }, [entityId]);

  // Draft management
  const draft = useDraftLayout(
    entityType,
    entityId,
    activeLayout.id || DEFAULT_LAYOUT_ID,
    userId,
    serverUpdatedAt
  );

  const isDirty = useMemo(() => {
    if (activeLayout.isDefault) return false;
    if (!originalConfig) return false;
    return !areLayoutConfigsEqual(activeLayout.config, originalConfig);
  }, [activeLayout, originalConfig]);

  // Load layout from storage on mount ONLY (not after saves)
  useEffect(() => {
    // Only run initial load once per entity
    if (initialLoadDoneRef.current) return;
    if (storage.isLoading || !storage.savedLayouts) return;
    
    initialLoadDoneRef.current = true;
    
    // Priority 1: Last active layout for this entity (from sessionStorage)
    const lastActiveId = entityId ? getLastActiveLayoutId(entityType, entityId) : null;
    
    let layoutToLoad = lastActiveId && lastActiveId !== DEFAULT_LAYOUT_ID
      ? storage.savedLayouts.find((l) => l.id === lastActiveId)
      : undefined;
    
    // Priority 2: User's default layout
    if (!layoutToLoad) {
      layoutToLoad = storage.savedLayouts.find((l) => l.isUserDefault);
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[useLayoutManager] LAYOUT_LOAD:', {
        entityType,
        entityId,
        source: lastActiveId && layoutToLoad ? 'sessionStorage' : layoutToLoad ? 'userDefault' : 'systemDefault',
        layoutId: layoutToLoad?.id || DEFAULT_LAYOUT_ID,
        widgetCount: layoutToLoad?.layoutJson?.widgets?.length ?? null,
      });
    }
    
    if (layoutToLoad) {
      const active = dbRowToActiveLayout(layoutToLoad, entityType);
      setActiveLayout(active);
      setOriginalConfig(cloneLayoutConfig(active.config));
      setOriginalTimelineState({ ...active.timelineState });
      setServerUpdatedAt(layoutToLoad.updatedAt);
    } else {
      setActiveLayout(getDefaultLayout(entityType));
      setOriginalConfig(null);
      setOriginalTimelineState(null);
      setServerUpdatedAt(null);
    }
  }, [storage.isLoading, storage.savedLayouts, entityType, entityId]);

  // Auto-apply draft if exists and not yet applied (only for non-default layouts)
  useEffect(() => {
    if (
      !activeLayout.isDefault && 
      draft.state.hasDraft && 
      draft.state.draftData && 
      !draftAppliedRef.current &&
      !isDirty
    ) {
      // Don't auto-apply, just show the banner
      // User will click "Restore Draft" to apply
    }
  }, [activeLayout.isDefault, draft.state.hasDraft, draft.state.draftData, isDirty]);

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
    // Clear draft applied flag when switching layouts
    draftAppliedRef.current = false;
    
    // Persist active layout choice in sessionStorage
    if (entityId) {
      if (layoutId === DEFAULT_LAYOUT_ID) {
        clearLastActiveLayoutId(entityType, entityId);
      } else {
        setLastActiveLayoutId(entityType, entityId, layoutId);
      }
    }
    
    if (layoutId === DEFAULT_LAYOUT_ID) {
      setActiveLayout(getDefaultLayout(entityType));
      setOriginalConfig(null);
      setOriginalTimelineState(null);
      setServerUpdatedAt(null);
      setIsCustomizing(false);
    } else {
      const saved = storage.savedLayouts.find((l) => l.id === layoutId);
      if (saved) {
        const active = dbRowToActiveLayout(saved, entityType);
        setActiveLayout(active);
        setOriginalConfig(cloneLayoutConfig(active.config));
        setOriginalTimelineState({ ...active.timelineState });
        setServerUpdatedAt(saved.updatedAt);
        setIsCustomizing(false);
      }
    }
  }, [storage.savedLayouts, entityType, entityId]);

  const updatePositions = useCallback((positions: WidgetPosition[]) => {
    setActiveLayout((prev) => {
      const newLayout = { ...prev, config: { ...prev.config, widgets: positions } };
      // Save draft to localStorage for non-default layouts
      if (!prev.isDefault && userId) {
        draft.actions.saveDraftLocally(
          newLayout.config,
          newLayout.timelineState,
          newLayout.widgetPrefs
        );
      }
      return newLayout;
    });
  }, [userId, draft.actions]);

  const toggleWidgetVisibility = useCallback((widgetId: string) => {
    setActiveLayout((prev) => {
      const hiddenWidgets = prev.config.hiddenWidgets || [];
      const isHidden = hiddenWidgets.includes(widgetId);
      const newLayout = {
        ...prev,
        config: {
          ...prev.config,
          hiddenWidgets: isHidden ? hiddenWidgets.filter((id) => id !== widgetId) : [...hiddenWidgets, widgetId],
        },
      };
      // Save draft to localStorage for non-default layouts
      if (!prev.isDefault && userId) {
        draft.actions.saveDraftLocally(
          newLayout.config,
          newLayout.timelineState,
          newLayout.widgetPrefs
        );
      }
      return newLayout;
    });
  }, [userId, draft.actions]);

  const updateTimelineState = useCallback((timelineState: TimelineState) => {
    setActiveLayout((prev) => {
      const newLayout = { ...prev, timelineState };
      // Save draft to localStorage for non-default layouts
      if (!prev.isDefault && userId) {
        draft.actions.saveDraftLocally(
          newLayout.config,
          newLayout.timelineState,
          newLayout.widgetPrefs
        );
      }
      return newLayout;
    });
  }, [userId, draft.actions]);

  // Save draft locally (called on edits)
  const saveDraftLocally = useCallback(() => {
    if (activeLayout.isDefault) return;
    
    draft.actions.saveDraftLocally(
      activeLayout.config,
      activeLayout.timelineState,
      activeLayout.widgetPrefs
    );
  }, [activeLayout, draft.actions]);

  // Clear local draft
  const clearLocalDraft = useCallback(() => {
    draft.actions.clearLocalDraft();
  }, [draft.actions]);

  // Apply draft to current layout
  const applyDraft = useCallback(() => {
    const draftData = draft.actions.applyDraft();
    if (!draftData) return;
    
    setActiveLayout((prev) => ({
      ...prev,
      config: draftData.config,
      timelineState: draftData.timelineState,
      widgetPrefs: draftData.widgetPrefs,
    }));
    draftAppliedRef.current = true;
    toast.info("Draft restored");
  }, [draft.actions]);

  // Save layout to database (explicit user action)
  const saveLayout = useCallback(async (name?: string) => {
    const nextSlot = storage.nextAvailableSlot();
    
    try {
      if (activeLayout.isDefault && nextSlot) {
        const saved = await storage.saveLayout({
          slotNumber: nextSlot,
          name: name || `Layout ${nextSlot}`,
          layoutJson: activeLayout.config,
          timelineStateJson: activeLayout.timelineState,
          widgetPrefsJson: activeLayout.widgetPrefs,
        });
        const active = dbRowToActiveLayout(saved, entityType);
        setActiveLayout(active);
        setOriginalConfig(cloneLayoutConfig(active.config));
        setOriginalTimelineState({ ...active.timelineState });
        setServerUpdatedAt(saved.updatedAt);
        
        // Persist new layout selection in sessionStorage
        if (entityId && saved.id) {
          setLastActiveLayoutId(entityType, entityId, saved.id);
        }
        
        // Clear local draft on successful save
        clearLocalDraft();
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[useLayoutManager] SAVE_SUCCESS (new):', {
            entityType,
            entityId,
            layoutId: saved.id,
            widgetCount: activeLayout.config.widgets.length,
            updatedAt: saved.updatedAt,
          });
        }
        
        toast.success("Layout saved");
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
        setOriginalTimelineState({ ...activeLayout.timelineState });
        if (saved?.updatedAt) {
          setServerUpdatedAt(saved.updatedAt);
        }
        
        // Clear local draft on successful save
        clearLocalDraft();
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[useLayoutManager] SAVE_SUCCESS (update):', {
            entityType,
            entityId,
            layoutId: activeLayout.id,
            widgetCount: activeLayout.config.widgets.length,
            updatedAt: saved?.updatedAt,
          });
        }
        
        toast.success("Layout saved");
        return saved;
      }
    } catch (error) {
      console.error("[useLayoutManager] Save failed:", error);
      toast.error("Failed to save layout");
      throw error;
    }
    return null;
  }, [activeLayout, storage, clearLocalDraft]);

  const renameLayout = useCallback(async (newName: string) => {
    if (!activeLayout.id || activeLayout.isDefault) return;
    await storage.updateLayout({ layoutId: activeLayout.id, name: newName });
    setActiveLayout((prev) => ({ ...prev, name: newName }));
  }, [activeLayout, storage]);

  const deleteLayout = useCallback(async () => {
    if (!activeLayout.id || activeLayout.isDefault) return;
    
    // Clear draft before deleting
    clearLocalDraft();
    
    await storage.deleteLayout(activeLayout.id);
    setActiveLayout(getDefaultLayout(entityType));
    setOriginalConfig(null);
    setOriginalTimelineState(null);
    setServerUpdatedAt(null);
    setIsCustomizing(false);
  }, [activeLayout, storage, clearLocalDraft, entityType]);

  const setAsUserDefault = useCallback(async () => {
    if (!activeLayout.id || activeLayout.isDefault) return;
    await storage.setAsUserDefault(activeLayout.id);
  }, [activeLayout, storage]);

  const revertToDefault = useCallback(() => {
    const defaultLayout = getDefaultLayout(entityType);
    setActiveLayout((prev) => ({ ...prev, config: cloneLayoutConfig(defaultLayout.config) }));
  }, [entityType]);

  const discardChanges = useCallback(() => {
    // Clear local draft
    clearLocalDraft();
    
    // Revert to original saved state
    if (originalConfig) {
      setActiveLayout((prev) => ({ 
        ...prev, 
        config: cloneLayoutConfig(originalConfig),
        timelineState: originalTimelineState ? { ...originalTimelineState } : prev.timelineState,
      }));
    }
    setIsCustomizing(false);
  }, [originalConfig, originalTimelineState, clearLocalDraft]);

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
    const active = dbRowToActiveLayout(saved, entityType);
    setActiveLayout(active);
    setOriginalConfig(cloneLayoutConfig(active.config));
    setOriginalTimelineState({ ...active.timelineState });
    setServerUpdatedAt(saved.updatedAt);
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
      hasDraft: draft.state.hasDraft && !isDirty && !activeLayout.isDefault,
      draftUpdatedAt: draft.state.draftUpdatedAt,
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
      saveDraftLocally,
      clearLocalDraft,
      applyDraft,
    },
  };
}
