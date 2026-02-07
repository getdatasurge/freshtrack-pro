/**
 * Hook to fetch sensor uplink interval from sensor_configurations table
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
        .select("id, dev_eui, is_primary")
        .eq("unit_id", unitId)
        .eq("is_primary", true)
        .maybeSingle();

      if (sensorError) return null;

      if (!sensorData) {
        // Try to get ANY sensor for this unit as fallback
        const { data: anySensor, error: anyError } = await supabase
          .from("lora_sensors")
          .select("id, dev_eui, is_primary")
          .eq("unit_id", unitId)
          .limit(1)
          .maybeSingle();

        if (anyError || !anySensor) return null;
        return fetchSensorConfig(anySensor.id);
      }

      return fetchSensorConfig(sensorData.id);
    },
    enabled: !!unitId,
    staleTime: 60000, // Cache for 1 minute
    retry: 1,
  });
}

async function fetchSensorConfig(sensorId: string): Promise<number | null> {
  const { data: configData, error: configError } = await supabase
    .from("sensor_configurations")
    .select("uplink_interval_s")
    .eq("sensor_id", sensorId)
    .maybeSingle();

  if (configError || !configData || !configData.uplink_interval_s) {
    return null;
  }

  return Math.round(configData.uplink_interval_s / 60);
}
