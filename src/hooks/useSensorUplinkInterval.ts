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

      // Get the primary TEMP/COMBO sensor for this unit.
      // Exclude door/contact sensors — they have a different uplink cadence.
      // Use .limit(1) to avoid maybeSingle() error when multiple sensors
      // have is_primary=true (each sensor_type group has its own primary).
      const { data: sensorRows, error: sensorError } = await supabase
        .from("lora_sensors")
        .select("id, dev_eui, is_primary, sensor_type")
        .eq("unit_id", unitId)
        .not("sensor_type", "in", '("door","contact")')
        .is("deleted_at", null)
        .order("is_primary", { ascending: false })
        .limit(1);

      if (sensorError) return null;

      const sensorData = sensorRows?.[0] ?? null;

      if (!sensorData) {
        // No temp/combo sensor — try ANY sensor as last resort
        const { data: anySensor, error: anyError } = await supabase
          .from("lora_sensors")
          .select("id, dev_eui, is_primary")
          .eq("unit_id", unitId)
          .is("deleted_at", null)
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
