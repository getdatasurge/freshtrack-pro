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

      console.log("[useSensorUplinkInterval] Fetching for unit:", unitId);

      // Get the primary sensor for this unit
      const { data: sensorData, error: sensorError } = await supabase
        .from("lora_sensors")
        .select("id, dev_eui, is_primary")
        .eq("unit_id", unitId)
        .eq("is_primary", true)
        .maybeSingle();

      if (sensorError) {
        console.error("[useSensorUplinkInterval] Error fetching sensor:", sensorError);
        return null;
      }

      if (!sensorData) {
        console.warn("[useSensorUplinkInterval] No primary sensor found for unit:", unitId);
        // Try to get ANY sensor for this unit as fallback
        const { data: anySensor, error: anyError } = await supabase
          .from("lora_sensors")
          .select("id, dev_eui, is_primary")
          .eq("unit_id", unitId)
          .limit(1)
          .maybeSingle();

        if (anyError || !anySensor) {
          console.warn("[useSensorUplinkInterval] No sensors at all for unit:", unitId);
          return null;
        }

        console.log("[useSensorUplinkInterval] Using non-primary sensor:", anySensor.dev_eui);
        return fetchSensorConfig(anySensor.id);
      }

      console.log("[useSensorUplinkInterval] Found primary sensor:", sensorData.dev_eui);
      return fetchSensorConfig(sensorData.id);
    },
    enabled: !!unitId,
    staleTime: 60000, // Cache for 1 minute
    retry: 1,
  });
}

async function fetchSensorConfig(sensorId: string): Promise<number | null> {
  // Get the sensor configuration from sensor_configurations table
  const { data: configData, error: configError } = await supabase
    .from("sensor_configurations")
    .select("uplink_interval_s")
    .eq("sensor_id", sensorId)
    .maybeSingle();

  if (configError) {
    console.error("[useSensorUplinkInterval] Error fetching sensor config:", configError);
    return null;
  }

  if (!configData || !configData.uplink_interval_s) {
    console.warn("[useSensorUplinkInterval] No sensor config or uplink_interval_s for sensor:", sensorId);
    return null;
  }

  const intervalMinutes = Math.round(configData.uplink_interval_s / 60);
  console.log("[useSensorUplinkInterval] Uplink interval:", configData.uplink_interval_s, "seconds =", intervalMinutes, "minutes");

  return intervalMinutes;
}
