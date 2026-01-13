import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { useCallback } from "react";

/**
 * Hook for managing sensor dashboard URL state.
 * Handles query params: ?sensor=<sensorId>&layout=<layoutId|default>
 */
export function useSensorDashboardUrl() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { unitId } = useParams<{ unitId: string }>();

  const selectedSensorId = searchParams.get("sensor");
  const selectedLayoutKey = searchParams.get("layout") || "default";

  /**
   * Navigate to a specific sensor's layout dashboard
   */
  const navigateToSensorLayout = useCallback(
    (targetUnitId: string, sensorId: string, layoutKey: string = "default") => {
      const params = new URLSearchParams();
      params.set("sensor", sensorId);
      if (layoutKey !== "default") {
        params.set("layout", layoutKey);
      }
      navigate(`/units/${targetUnitId}?${params.toString()}`);
    },
    [navigate]
  );

  /**
   * Update layout selection without changing sensor
   */
  const setLayoutKey = useCallback(
    (layoutKey: string) => {
      const newParams = new URLSearchParams(searchParams);
      if (layoutKey === "default") {
        newParams.delete("layout");
      } else {
        newParams.set("layout", layoutKey);
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  /**
   * Update sensor selection (optionally reset layout)
   */
  const setSensorId = useCallback(
    (sensorId: string, resetLayout = true) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("sensor", sensorId);
      if (resetLayout) {
        newParams.delete("layout");
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  /**
   * Build URL for a sensor layout (for NavLink href)
   */
  const buildSensorLayoutUrl = useCallback(
    (targetUnitId: string, sensorId: string, layoutKey: string = "default") => {
      const params = new URLSearchParams();
      params.set("sensor", sensorId);
      if (layoutKey !== "default") {
        params.set("layout", layoutKey);
      }
      return `/units/${targetUnitId}?${params.toString()}`;
    },
    []
  );

  /**
   * Check if a given sensor/layout combo is currently active
   */
  const isActive = useCallback(
    (targetUnitId: string, sensorId: string, layoutKey: string = "default") => {
      if (unitId !== targetUnitId) return false;
      if (selectedSensorId !== sensorId) return false;
      const currentLayout = selectedLayoutKey || "default";
      const targetLayout = layoutKey || "default";
      return currentLayout === targetLayout;
    },
    [unitId, selectedSensorId, selectedLayoutKey]
  );

  return {
    unitId,
    selectedSensorId,
    selectedLayoutKey,
    navigateToSensorLayout,
    setLayoutKey,
    setSensorId,
    buildSensorLayoutUrl,
    isActive,
  };
}
