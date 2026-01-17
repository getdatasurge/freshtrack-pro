import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

/**
 * Layout slot for navigation display
 */
export interface LayoutSlot {
  slotNumber: 1 | 2 | 3;
  layoutId: string | null;
  name: string;
  isUserDefault: boolean;
}

/**
 * Unit navigation item (without sensor nesting)
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
  layouts: LayoutSlot[];
  sensorCount: number;
}

/**
 * Site navigation item
 */
export interface SiteNavItem {
  siteId: string;
  siteName: string;
  layouts: LayoutSlot[];
  units: UnitNavItem[];
}

/**
 * Complete navigation tree
 */
export interface NavTree {
  sites: SiteNavItem[];
  hasSingleSite: boolean;
  isLoading: boolean;
  error: Error | null;
}

// Raw data from DB
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
    };
  };
}

interface RawSensor {
  id: string;
  unit_id: string;
}

interface RawLayout {
  id: string;
  entity_type: string;
  entity_id: string;
  slot_number: number;
  name: string;
  is_user_default: boolean;
}

/**
 * Map layouts to fixed 3-slot structure
 */
function mapLayoutsToSlots(layouts: RawLayout[]): LayoutSlot[] {
  const slots: LayoutSlot[] = [];
  
  // Sort by slot_number
  const sorted = [...layouts].sort((a, b) => a.slot_number - b.slot_number);
  
  for (const layout of sorted) {
    if (layout.slot_number >= 1 && layout.slot_number <= 3) {
      slots.push({
        slotNumber: layout.slot_number as 1 | 2 | 3,
        layoutId: layout.id,
        name: layout.name,
        isUserDefault: layout.is_user_default,
      });
    }
  }
  
  return slots;
}

/**
 * Hook to fetch the complete navigation tree for the sidebar.
 * Structure: Sites > Units > Layouts
 */
export function useNavTree(organizationId: string | null): NavTree {
  // Debug logging for impersonation context
  if (import.meta.env.DEV) {
    console.log('[useNavTree] Called with organizationId:', organizationId);
  }

  // First fetch all sites for this organization
  const { data: allSites = [], isLoading: sitesLoading, error: sitesError } = useQuery({
    queryKey: ["nav-tree-all-sites", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      if (import.meta.env.DEV) {
        console.log('[useNavTree] Fetching sites for org:', organizationId);
      }

      const { data, error } = await supabase
        .from("sites")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");

      if (error) {
        console.error("[useNavTree] Sites query error:", error);
        throw error;
      }

      if (import.meta.env.DEV) {
        console.log('[useNavTree] Sites fetched:', data?.length, 'sites', data?.map(s => ({ id: s.id, name: s.name })));
      }

      return data as { id: string; name: string }[];
    },
    enabled: !!organizationId,
    staleTime: 1000 * 30,
  });

  // Extract site IDs for filtering areas
  const siteIds = allSites.map(s => s.id);

  // Debug log siteIds
  if (import.meta.env.DEV && siteIds.length > 0) {
    console.log('[useNavTree] siteIds for areas query:', siteIds);
  }

  // Fetch area IDs using site IDs (direct column filter, not relationship filter)
  const { data: areaIds = [], isLoading: areasLoading, error: areasError } = useQuery({
    queryKey: ["nav-tree-areas", organizationId, siteIds],
    queryFn: async () => {
      if (!organizationId || siteIds.length === 0) return [];

      if (import.meta.env.DEV) {
        console.log('[useNavTree] Fetching areas for siteIds:', siteIds);
      }

      const { data, error } = await supabase
        .from("areas")
        .select("id")
        .in("site_id", siteIds)
        .eq("is_active", true);

      if (error) {
        console.error("[useNavTree] Areas query error:", error);
        throw error;
      }

      if (import.meta.env.DEV) {
        console.log('[useNavTree] Areas fetched:', data?.length, 'areas', data?.map(a => a.id));
      }

      return (data || []).map(a => a.id);
    },
    enabled: !!organizationId && siteIds.length > 0,
    staleTime: 1000 * 30,
  });

  // Debug log areaIds
  if (import.meta.env.DEV && areaIds.length > 0) {
    console.log('[useNavTree] areaIds for units query:', areaIds);
  }

  // Fetch all active units with their hierarchy, filtered by org's area IDs
  const { data: units = [], isLoading: unitsLoading, error: unitsError } = useQuery({
    queryKey: ["nav-tree-units", organizationId, areaIds],
    queryFn: async () => {
      if (!organizationId || areaIds.length === 0) return [];

      if (import.meta.env.DEV) {
        console.log('[useNavTree] Fetching units for areaIds:', areaIds);
      }

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
            site:sites!inner(
              id,
              name
            )
          )
        `)
        .eq("is_active", true)
        .in("area_id", areaIds)
        .order("name");

      if (error) {
        console.error("[useNavTree] Units query error:", error);
        throw error;
      }

      if (import.meta.env.DEV) {
        console.log('[useNavTree] Units fetched:', data?.length, 'units', data?.map(u => ({ id: u.id, name: u.name })));
      }

      return data as unknown as RawUnit[];
    },
    enabled: !!organizationId && areaIds.length > 0,
    staleTime: 1000 * 30, // 30 seconds
  });

  // Fetch sensor counts per unit
  const { data: sensors = [], isLoading: sensorsLoading } = useQuery({
    queryKey: ["nav-tree-sensors", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("lora_sensors")
        .select("id, unit_id")
        .eq("organization_id", organizationId)
        .not("unit_id", "is", null);

      if (error) throw error;
      return data as RawSensor[];
    },
    enabled: !!organizationId,
    staleTime: 1000 * 30,
  });

  // Fetch ALL org layouts for all entities (org-wide sharing)
  const { data: layouts = [], isLoading: layoutsLoading } = useQuery({
    queryKey: ["nav-tree-layouts", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("entity_dashboard_layouts")
        .select("id, entity_type, entity_id, slot_number, name, is_user_default")
        .eq("organization_id", organizationId)
        .order("slot_number", { ascending: true });

      if (error) throw error;
      return data as RawLayout[];
    },
    enabled: !!organizationId,
    staleTime: 1000 * 30,
  });

  // Build navigation tree
  const sites = useMemo(() => {
    // Group units by site
    const siteMap = new Map<string, SiteNavItem>();

    // Create sensor count map
    const sensorCountMap = new Map<string, number>();
    for (const sensor of sensors) {
      if (sensor.unit_id) {
        sensorCountMap.set(sensor.unit_id, (sensorCountMap.get(sensor.unit_id) || 0) + 1);
      }
    }

    // Group layouts by entity
    const unitLayoutsMap = new Map<string, RawLayout[]>();
    const siteLayoutsMap = new Map<string, RawLayout[]>();

    for (const layout of layouts) {
      if (layout.entity_type === 'unit') {
        const existing = unitLayoutsMap.get(layout.entity_id) || [];
        existing.push(layout);
        unitLayoutsMap.set(layout.entity_id, existing);
      } else if (layout.entity_type === 'site') {
        const existing = siteLayoutsMap.get(layout.entity_id) || [];
        existing.push(layout);
        siteLayoutsMap.set(layout.entity_id, existing);
      }
    }

    // First, add all sites (even those without units)
    for (const site of allSites) {
      if (!siteMap.has(site.id)) {
        siteMap.set(site.id, {
          siteId: site.id,
          siteName: site.name,
          layouts: mapLayoutsToSlots(siteLayoutsMap.get(site.id) || []),
          units: [],
        });
      }
    }

    // Build units and group by site
    for (const unit of units) {
      const siteId = unit.area.site.id;
      const siteName = unit.area.site.name;

      if (!siteMap.has(siteId)) {
        siteMap.set(siteId, {
          siteId,
          siteName,
          layouts: mapLayoutsToSlots(siteLayoutsMap.get(siteId) || []),
          units: [],
        });
      }

      const unitItem: UnitNavItem = {
        unitId: unit.id,
        unitName: unit.name,
        unitType: unit.unit_type,
        status: unit.status,
        areaId: unit.area.id,
        areaName: unit.area.name,
        siteId,
        siteName,
        layouts: mapLayoutsToSlots(unitLayoutsMap.get(unit.id) || []),
        sensorCount: sensorCountMap.get(unit.id) || 0,
      };

      siteMap.get(siteId)!.units.push(unitItem);
    }

    // Sort units within each site
    for (const site of siteMap.values()) {
      site.units.sort((a, b) => a.unitName.localeCompare(b.unitName));
    }

    // Convert to array and sort by site name
    return Array.from(siteMap.values()).sort((a, b) => a.siteName.localeCompare(b.siteName));
  }, [units, sensors, layouts, allSites]);

  // Summary debug log
  if (import.meta.env.DEV) {
    const totalUnits = sites.reduce((sum, s) => sum + s.units.length, 0);
    console.log('[useNavTree] Summary:', {
      organizationId,
      sitesCount: sites.length,
      totalUnits,
      isLoading: areasLoading || unitsLoading || sensorsLoading || layoutsLoading || sitesLoading,
      queryStates: {
        sites: { count: allSites.length, loading: sitesLoading, error: !!sitesError },
        areas: { count: areaIds.length, loading: areasLoading, error: !!areasError },
        units: { count: units.length, loading: unitsLoading, error: !!unitsError },
      }
    });
  }

  // Combine errors for better diagnostics
  const combinedError = sitesError || areasError || unitsError;

  return {
    sites,
    hasSingleSite: sites.length === 1,
    isLoading: areasLoading || unitsLoading || sensorsLoading || layoutsLoading || sitesLoading,
    error: combinedError as Error | null,
  };
}
