/**
 * Hook to fetch sensor uplink interval from sensor_config table
 *
 * This is the TRUE source of truth for uplink intervals.
 * Returns the interval in MINUTES (converted from seconds).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";

export function useSensorUplinkInterval(unitId: string | null) {
  return useQuery({
    queryKey: qk.unit(unitId).sensorUplinkInterval(),
    queryFn: async (): Promise<number | null> => {
      if (!unitId) return null;

      // Get the primary sensor for this unit
      const { data: sensorData, error: sensorError } = await supabase
        .from("lora_sensors")
        .select("id")
        .eq("unit_id", unitId)
        .eq("is_primary", true)
        .maybeSingle();

      if (sensorError || !sensorData) {
        console.warn("No primary sensor found for unit:", unitId);
        return null;
      }

      // Get the sensor configuration
      const { data: configData, error: configError } = await supabase
        .from("sensor_config")
        .select("uplink_interval_s")
        .eq("sensor_id", sensorData.id)
        .maybeSingle();

      if (configError || !configData || !configData.uplink_interval_s) {
        console.warn("No sensor config found for sensor:", sensorData.id);
        return null;
      }

      // Convert seconds to minutes
      return Math.round(configData.uplink_interval_s / 60);
    },
    enabled: !!unitId,
    staleTime: 60000, // Cache for 1 minute
  });
}
