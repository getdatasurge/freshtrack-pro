import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "frostguard-sidebar-expand-state";

interface ExpandState {
  expandedSites: string[];
  expandedUnits: string[];
  sitesCollapsed: boolean;
  unitsCollapsed: boolean;
}

const DEFAULT_STATE: ExpandState = {
  expandedSites: [],
  expandedUnits: [],
  sitesCollapsed: false,
  unitsCollapsed: false,
};

// ========== SINGLETON STORE ==========

function loadFromStorage(): ExpandState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        expandedSites: parsed.expandedSites || [],
        expandedUnits: parsed.expandedUnits || [],
        sitesCollapsed: parsed.sitesCollapsed ?? false,
        unitsCollapsed: parsed.unitsCollapsed ?? false,
      };
    }
  } catch (e) {
    console.warn("[useSidebarExpandState] Failed to load:", e);
  }
  return DEFAULT_STATE;
}

function saveToStorage(state: ExpandState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[useSidebarExpandState] Failed to save:", e);
  }
}

// Module-level state (singleton) - loaded once at module initialization
let currentState: ExpandState = loadFromStorage();
const listeners: Set<() => void> = new Set();

function getSnapshot(): ExpandState {
  return currentState;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function updateState(updater: (prev: ExpandState) => ExpandState): void {
  const newState = updater(currentState);
  if (newState !== currentState) {
    currentState = newState;
    saveToStorage(newState);
    // Notify all subscribers
    listeners.forEach((listener) => listener());
  }
}

// ========== HOOK ==========

/**
 * Hook for managing sidebar expand/collapse state.
 * Uses a singleton store pattern with useSyncExternalStore to ensure
 * all hook instances share the same state and persist to localStorage.
 *
 * Scopes: Sites and Units (no sensor-level expand state)
 */
export function useSidebarExpandState() {
  // useSyncExternalStore ensures all hook instances share the same state
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const isSiteExpanded = useCallback(
    (siteId: string) => state.expandedSites.includes(siteId),
    [state.expandedSites]
  );

  const isUnitExpanded = useCallback(
    (unitId: string) => state.expandedUnits.includes(unitId),
    [state.expandedUnits]
  );

  const toggleSite = useCallback((siteId: string) => {
    updateState((prev) => ({
      ...prev,
      expandedSites: prev.expandedSites.includes(siteId)
        ? prev.expandedSites.filter((id) => id !== siteId)
        : [...prev.expandedSites, siteId],
    }));
  }, []);

  const toggleUnit = useCallback((unitId: string) => {
    updateState((prev) => ({
      ...prev,
      expandedUnits: prev.expandedUnits.includes(unitId)
        ? prev.expandedUnits.filter((id) => id !== unitId)
        : [...prev.expandedUnits, unitId],
    }));
  }, []);

  const expandSite = useCallback((siteId: string) => {
    updateState((prev) => {
      if (prev.expandedSites.includes(siteId)) return prev;
      return { ...prev, expandedSites: [...prev.expandedSites, siteId] };
    });
  }, []);

  const expandUnit = useCallback((unitId: string) => {
    updateState((prev) => {
      if (prev.expandedUnits.includes(unitId)) return prev;
      return { ...prev, expandedUnits: [...prev.expandedUnits, unitId] };
    });
  }, []);

  /**
   * Auto-expand the path to show a specific unit.
   * If siteId is provided, also expands the site.
   */
  const expandToActive = useCallback((unitId: string, siteId?: string) => {
    updateState((prev) => {
      const newState = { ...prev, unitsCollapsed: false };
      if (siteId && !newState.expandedSites.includes(siteId)) {
        newState.expandedSites = [...newState.expandedSites, siteId];
      }
      if (!newState.expandedUnits.includes(unitId)) {
        newState.expandedUnits = [...newState.expandedUnits, unitId];
      }
      return newState;
    });
  }, []);

  /**
   * Auto-expand to show a specific site's layouts.
   * Expands the units section and the site accordion.
   */
  const expandToActiveSite = useCallback((siteId: string) => {
    updateState((prev) => {
      const newState = { ...prev, unitsCollapsed: false };
      if (!newState.expandedSites.includes(siteId)) {
        newState.expandedSites = [...newState.expandedSites, siteId];
      }
      return newState;
    });
  }, []);

  const toggleUnitsSection = useCallback(() => {
    updateState((prev) => ({ ...prev, unitsCollapsed: !prev.unitsCollapsed }));
  }, []);

  const toggleSitesSection = useCallback(() => {
    updateState((prev) => ({ ...prev, sitesCollapsed: !prev.sitesCollapsed }));
  }, []);

  return {
    isSiteExpanded,
    isUnitExpanded,
    toggleSite,
    toggleUnit,
    expandSite,
    expandUnit,
    expandToActive,
    expandToActiveSite,
    isUnitsSectionCollapsed: state.unitsCollapsed,
    toggleUnitsSection,
    isSitesSectionCollapsed: state.sitesCollapsed,
    toggleSitesSection,
  };
}
