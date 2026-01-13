import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "frostguard-sidebar-expand-state";

interface ExpandState {
  expandedUnits: string[];
  expandedSensors: string[];
  unitsCollapsed: boolean;
}

const DEFAULT_STATE: ExpandState = {
  expandedUnits: [],
  expandedSensors: [],
  unitsCollapsed: false,
};

function loadFromStorage(): ExpandState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_STATE, ...JSON.parse(stored) };
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
 */
export function useSidebarExpandState() {
  const [state, setState] = useState<ExpandState>(loadFromStorage);

  // Persist to storage on state change
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const isUnitExpanded = useCallback(
    (unitId: string) => state.expandedUnits.includes(unitId),
    [state.expandedUnits]
  );

  const isSensorExpanded = useCallback(
    (sensorId: string) => state.expandedSensors.includes(sensorId),
    [state.expandedSensors]
  );

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

  const toggleSensor = useCallback((sensorId: string) => {
    setState((prev) => {
      const isExpanded = prev.expandedSensors.includes(sensorId);
      return {
        ...prev,
        expandedSensors: isExpanded
          ? prev.expandedSensors.filter((id) => id !== sensorId)
          : [...prev.expandedSensors, sensorId],
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

  const expandSensor = useCallback((sensorId: string) => {
    setState((prev) => {
      if (prev.expandedSensors.includes(sensorId)) return prev;
      return {
        ...prev,
        expandedSensors: [...prev.expandedSensors, sensorId],
      };
    });
  }, []);

  /**
   * Auto-expand the path to show a specific unit and sensor
   */
  const expandToActive = useCallback((unitId: string, sensorId?: string) => {
    setState((prev) => {
      const newState = { ...prev };
      
      // Expand units section
      newState.unitsCollapsed = false;
      
      // Expand the unit
      if (!newState.expandedUnits.includes(unitId)) {
        newState.expandedUnits = [...newState.expandedUnits, unitId];
      }
      
      // Expand the sensor if specified
      if (sensorId && !newState.expandedSensors.includes(sensorId)) {
        newState.expandedSensors = [...newState.expandedSensors, sensorId];
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

  const isUnitsSectionCollapsed = state.unitsCollapsed;

  return {
    isUnitExpanded,
    isSensorExpanded,
    toggleUnit,
    toggleSensor,
    expandUnit,
    expandSensor,
    expandToActive,
    isUnitsSectionCollapsed,
    toggleUnitsSection,
  };
}
