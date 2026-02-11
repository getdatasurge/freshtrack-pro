/**
 * Batch-fetch sensor_configurations for a list of sensor IDs.
 *
 * Returns a Map<sensorId, uplink_interval_s | null> for O(1) lookup
 * when computing display status for the sensors table.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSensorConfigurations(sensorIds: string[]) {
  return useQuery({
    queryKey: ["sensor-configurations-batch", ...sensorIds.slice().sort()],
    queryFn: async (): Promise<Map<string, number | null>> => {
      if (sensorIds.length === 0) return new Map();

      const { data, error } = await supabase
        .from("sensor_configurations")
        .select("sensor_id, uplink_interval_s")
        .in("sensor_id", sensorIds);

      if (error) throw error;

      const map = new Map<string, number | null>();
      for (const row of data ?? []) {
        map.set(row.sensor_id, row.uplink_interval_s ?? null);
      }
      return map;
    },
    enabled: sensorIds.length > 0,
    staleTime: 60_000, // 1 min — config changes rarely
  });
}
