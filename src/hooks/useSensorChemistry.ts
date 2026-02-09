/**
 * Hook to resolve battery chemistry from sensor_catalog for a given sensor.
 *
 * Looks up sensor_catalog.battery_info.chemistry via sensor_catalog_id.
 * Falls back to "LiFeS2_AA" when no catalog entry exists.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSensorChemistry(sensorCatalogId: string | null | undefined) {
  return useQuery({
    queryKey: ["sensor-chemistry", sensorCatalogId],
    queryFn: async (): Promise<string> => {
      if (!sensorCatalogId) return "LiFeS2_AA";

      const { data, error } = await supabase
        .from("sensor_catalog")
        .select("battery_info")
        .eq("id", sensorCatalogId)
        .maybeSingle();

      if (error || !data) return "LiFeS2_AA";

      const batteryInfo = data.battery_info as { chemistry?: string } | null;
      return batteryInfo?.chemistry || "LiFeS2_AA";
    },
    enabled: !!sensorCatalogId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes — chemistry doesn't change often
  });
}
