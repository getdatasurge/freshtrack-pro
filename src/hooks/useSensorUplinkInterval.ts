/**
 * Hook to fetch sensor uplink interval from sensor_configurations table
 *
 * This is the TRUE source of truth for uplink intervals.
 * Returns the interval in MINUTES (converted from seconds).
 *
 * Fallback chain:
 * 1. sensor_configurations.confirmed_uplink_interval_s (sensor-acknowledged)
 * 2. sensor_configurations.uplink_interval_s (pending/legacy)
 * 3. sensor_catalog.uplink_info.default_interval_s (catalog default)
 * 4. null (no data — caller decides final fallback)
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
        .select("id, dev_eui, is_primary, sensor_type, sensor_catalog_id")
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
          .select("id, dev_eui, is_primary, sensor_catalog_id")
          .eq("unit_id", unitId)
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();

        if (anyError || !anySensor) return null;
        return fetchSensorConfig(anySensor.id, anySensor.sensor_catalog_id);
      }

      return fetchSensorConfig(sensorData.id, sensorData.sensor_catalog_id);
    },
    enabled: !!unitId,
    staleTime: 60000, // Cache for 1 minute
    retry: 1,
  });
}

async function fetchSensorConfig(
  sensorId: string,
  catalogId?: string | null,
): Promise<number | null> {
  const { data: configData, error: configError } = await supabase
    .from("sensor_configurations")
    .select("uplink_interval_s, confirmed_uplink_interval_s")
    .eq("sensor_id", sensorId)
    .maybeSingle();

  if (!configError && configData) {
    // Prefer confirmed value (last sensor-acknowledged interval).
    // Fall back to uplink_interval_s for backward compatibility.
    const intervalS = configData.confirmed_uplink_interval_s ?? configData.uplink_interval_s;
    if (intervalS) {
      return Math.round(intervalS / 60);
    }
  }

  // No config row or both interval fields null — fall back to catalog default
  if (catalogId) {
    const { data: catalogData } = await supabase
      .from("sensor_catalog")
      .select("uplink_info")
      .eq("id", catalogId)
      .maybeSingle();

    if (catalogData?.uplink_info) {
      const uplinkInfo = catalogData.uplink_info as Record<string, unknown>;
      const defaultIntervalS = uplinkInfo?.default_interval_s;
      if (typeof defaultIntervalS === "number" && defaultIntervalS > 0) {
        return Math.round(defaultIntervalS / 60);
      }
    }
  }

  return null;
}
