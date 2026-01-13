import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

/**
 * Represents a layout slot (1, 2, or 3) for a sensor
 */
export interface LayoutSlot {
  slotNumber: 1 | 2 | 3;
  layoutId: string | null; // null = not created yet
  name: string; // "Layout 1" or custom name
  isUserDefault: boolean;
}

/**
 * Represents a sensor in the navigation tree
 */
export interface SensorNavItem {
  sensorId: string;
  sensorName: string;
  sensorType: string;
  isPrimary: boolean;
  status: string;
  layouts: LayoutSlot[]; // Always 3 slots
}

/**
 * Represents a unit in the navigation tree
 */
export interface UnitNavItem {
  unitId: string;
  unitName: string;
  unitType: string;
  status: string;
  areaId: string;
  areaName: string;
  siteId: string;
  siteName: string;
  sensors: SensorNavItem[];
}

/**
 * The complete navigation tree structure
 */
export interface UnitsNavTree {
  units: UnitNavItem[];
  isLoading: boolean;
  error: Error | null;
}

interface RawUnit {
  id: string;
  name: string;
  unit_type: string;
  status: string;
  area: {
    id: string;
    name: string;
    site: {
      id: string;
      name: string;
      organization_id: string;
    };
  };
}

interface RawSensor {
  id: string;
  name: string;
  sensor_type: string;
  is_primary: boolean;
  status: string;
  unit_id: string | null;
}

interface RawLayout {
  id: string;
  sensor_id: string;
  name: string;
  is_user_default: boolean;
  created_at: string;
}

/**
 * Maps saved layouts to fixed slot positions (1, 2, 3)
 * Layouts are assigned to slots in order of creation
 */
function mapLayoutsToSlots(sensorLayouts: RawLayout[]): LayoutSlot[] {
  const sortedLayouts = [...sensorLayouts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const slots: LayoutSlot[] = [];
  for (let i = 1; i <= 3; i++) {
    const layout = sortedLayouts[i - 1];
    slots.push({
      slotNumber: i as 1 | 2 | 3,
      layoutId: layout?.id || null,
      name: layout?.name || `Layout ${i}`,
      isUserDefault: layout?.is_user_default || false,
    });
  }

  return slots;
}

/**
 * Hook that builds a navigation tree of units, sensors, and their layouts.
 * Used by the sidebar for hierarchical navigation.
 */
export function useUnitsNavTree(orgId: string | null): UnitsNavTree {
  // Fetch all units for the organization
  const {
    data: units,
    isLoading: unitsLoading,
    error: unitsError,
  } = useQuery({
    queryKey: ["nav-units", orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from("units")
        .select(`
          id,
          name,
          unit_type,
          status,
          area:areas!inner(
            id,
            name,
            site:sites!inner(id, name, organization_id)
          )
        `)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;

      // Filter to only units in our org
      return (data || []).filter(
        (u: RawUnit) => u.area?.site?.organization_id === orgId
      ) as RawUnit[];
    },
    enabled: !!orgId,
    staleTime: 30_000, // Cache for 30 seconds
  });

  // Fetch all sensors for the organization
  const {
    data: sensors,
    isLoading: sensorsLoading,
    error: sensorsError,
  } = useQuery({
    queryKey: ["nav-sensors", orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from("lora_sensors")
        .select("id, name, sensor_type, is_primary, status, unit_id")
        .eq("organization_id", orgId)
        .order("is_primary", { ascending: false })
        .order("name");

      if (error) throw error;
      return (data || []) as RawSensor[];
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  // Fetch all layouts for current user in this org
  const {
    data: layouts,
    isLoading: layoutsLoading,
    error: layoutsError,
  } = useQuery({
    queryKey: ["nav-layouts", orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("sensor_dashboard_layouts")
        .select("id, sensor_id, name, is_user_default, created_at")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .order("created_at");

      if (error) throw error;
      return (data || []) as RawLayout[];
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  // Build the navigation tree
  const navTree = useMemo<UnitNavItem[]>(() => {
    if (!units || !sensors) return [];

    // Group sensors by unit_id
    const sensorsByUnit = new Map<string, RawSensor[]>();
    for (const sensor of sensors) {
      if (!sensor.unit_id) continue;
      const existing = sensorsByUnit.get(sensor.unit_id) || [];
      existing.push(sensor);
      sensorsByUnit.set(sensor.unit_id, existing);
    }

    // Group layouts by sensor_id
    const layoutsBySensor = new Map<string, RawLayout[]>();
    for (const layout of layouts || []) {
      const existing = layoutsBySensor.get(layout.sensor_id) || [];
      existing.push(layout);
      layoutsBySensor.set(layout.sensor_id, existing);
    }

    // Build tree
    return units.map((unit) => {
      const unitSensors = sensorsByUnit.get(unit.id) || [];

      const sensorItems: SensorNavItem[] = unitSensors.map((sensor) => {
        const sensorLayouts = layoutsBySensor.get(sensor.id) || [];
        return {
          sensorId: sensor.id,
          sensorName: sensor.name,
          sensorType: sensor.sensor_type,
          isPrimary: sensor.is_primary,
          status: sensor.status,
          layouts: mapLayoutsToSlots(sensorLayouts),
        };
      });

      return {
        unitId: unit.id,
        unitName: unit.name,
        unitType: unit.unit_type,
        status: unit.status,
        areaId: unit.area.id,
        areaName: unit.area.name,
        siteId: unit.area.site.id,
        siteName: unit.area.site.name,
        sensors: sensorItems,
      };
    });
  }, [units, sensors, layouts]);

  const isLoading = unitsLoading || sensorsLoading || layoutsLoading;
  const error = unitsError || sensorsError || layoutsError;

  return {
    units: navTree,
    isLoading,
    error: error as Error | null,
  };
}
