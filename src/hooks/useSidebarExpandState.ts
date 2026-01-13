import { useState, useCallback, useEffect } from "react";

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

function loadFromStorage(): ExpandState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate old state: remove sensor keys, ensure site keys exist
      return {
        expandedSites: parsed.expandedSites || [],
        expandedUnits: parsed.expandedUnits || [],
        sitesCollapsed: parsed.sitesCollapsed ?? false,
        unitsCollapsed: parsed.unitsCollapsed ?? false,
      };
    }
  } catch (e) {
    console.warn("[useSidebarExpandState] Failed to load from localStorage:", e);
  }
  return DEFAULT_STATE;
}

function saveToStorage(state: ExpandState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[useSidebarExpandState] Failed to save to localStorage:", e);
  }
}

/**
 * Hook for managing sidebar expand/collapse state.
 * Persists state in localStorage across sessions.
 * 
 * Scopes: Sites and Units (no sensor-level expand state)
 */
export function useSidebarExpandState() {
  const [state, setState] = useState<ExpandState>(loadFromStorage);

  // Persist to storage on state change
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const isSiteExpanded = useCallback(
    (siteId: string) => state.expandedSites.includes(siteId),
    [state.expandedSites]
  );

  const isUnitExpanded = useCallback(
    (unitId: string) => state.expandedUnits.includes(unitId),
    [state.expandedUnits]
  );

  const toggleSite = useCallback((siteId: string) => {
    setState((prev) => {
      const isExpanded = prev.expandedSites.includes(siteId);
      return {
        ...prev,
        expandedSites: isExpanded
          ? prev.expandedSites.filter((id) => id !== siteId)
          : [...prev.expandedSites, siteId],
      };
    });
  }, []);

  const toggleUnit = useCallback((unitId: string) => {
    setState((prev) => {
      const isExpanded = prev.expandedUnits.includes(unitId);
      return {
        ...prev,
        expandedUnits: isExpanded
          ? prev.expandedUnits.filter((id) => id !== unitId)
          : [...prev.expandedUnits, unitId],
      };
    });
  }, []);

  const expandSite = useCallback((siteId: string) => {
    setState((prev) => {
      if (prev.expandedSites.includes(siteId)) return prev;
      return {
        ...prev,
        expandedSites: [...prev.expandedSites, siteId],
      };
    });
  }, []);

  const expandUnit = useCallback((unitId: string) => {
    setState((prev) => {
      if (prev.expandedUnits.includes(unitId)) return prev;
      return {
        ...prev,
        expandedUnits: [...prev.expandedUnits, unitId],
      };
    });
  }, []);

  /**
   * Auto-expand the path to show a specific unit.
   * If siteId is provided, also expands the site.
   */
  const expandToActive = useCallback((unitId: string, siteId?: string) => {
    setState((prev) => {
      const newState = { ...prev };
      
      // Expand units section
      newState.unitsCollapsed = false;
      
      // Expand the site if provided
      if (siteId && !newState.expandedSites.includes(siteId)) {
        newState.expandedSites = [...newState.expandedSites, siteId];
      }
      
      // Expand the unit
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
    setState((prev) => {
      const newState = { ...prev };
      
      // Expand units section
      newState.unitsCollapsed = false;
      
      // Expand the site
      if (!newState.expandedSites.includes(siteId)) {
        newState.expandedSites = [...newState.expandedSites, siteId];
      }
      
      return newState;
    });
  }, []);

  const toggleUnitsSection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      unitsCollapsed: !prev.unitsCollapsed,
    }));
  }, []);

  const toggleSitesSection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sitesCollapsed: !prev.sitesCollapsed,
    }));
  }, []);

  const isUnitsSectionCollapsed = state.unitsCollapsed;
  const isSitesSectionCollapsed = state.sitesCollapsed;

  return {
    isSiteExpanded,
    isUnitExpanded,
    toggleSite,
    toggleUnit,
    expandSite,
    expandUnit,
    expandToActive,
    expandToActiveSite,
    isUnitsSectionCollapsed,
    toggleUnitsSection,
    isSitesSectionCollapsed,
    toggleSitesSection,
  };
}
