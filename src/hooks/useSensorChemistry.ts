/**
 * Hook to resolve battery chemistry from sensor_catalog for a given sensor.
 *
 * Looks up sensor_catalog.battery_info.chemistry via sensor_catalog_id.
 * Returns null when no catalog entry exists — callers must handle the null case
 * (e.g. fall back to stored battery_level instead of guessing a chemistry).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSensorChemistry(sensorCatalogId: string | null | undefined) {
  return useQuery({
    queryKey: ["sensor-chemistry", sensorCatalogId],
    queryFn: async (): Promise<string | null> => {
      if (!sensorCatalogId) return null;

      const { data, error } = await supabase
        .from("sensor_catalog")
        .select("battery_info")
        .eq("id", sensorCatalogId)
        .maybeSingle();

      if (error || !data) return null;

      const batteryInfo = data.battery_info as { chemistry?: string } | null;
      return batteryInfo?.chemistry || null;
    },
    enabled: !!sensorCatalogId,
    staleTime: 5 * 60 * 1000,
  });
}
