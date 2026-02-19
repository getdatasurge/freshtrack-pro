import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SensorCatalogEntry, SensorCatalogPublicEntry, SensorCatalogInsert } from "@/types/sensorCatalog";

const CATALOG_QUERY_KEY = ["sensor-catalog"];
const CATALOG_PUBLIC_QUERY_KEY = ["sensor-catalog-public"];

/**
 * Hook for org-level users to read visible, non-deprecated catalog entries.
 * Queries the sensor_catalog_public view which already filters for
 * is_visible=true AND deprecated_at IS NULL, and excludes internal fields.
 */
export function useSensorCatalogPublic() {
  return useQuery<SensorCatalogPublicEntry[]>({
    queryKey: CATALOG_PUBLIC_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sensor_catalog_public" as any)
        .select("*");

      if (error) throw error;
      return (data ?? []) as unknown as SensorCatalogPublicEntry[];
    },
    staleTime: 5 * 60_000, // 5 min — catalog changes rarely
  });
}

/**
 * Hook to fetch a single catalog entry by ID directly from the sensor_catalog
 * table (not the public view). This ensures downlink_info is always available,
 * even if the sensor_catalog_public view has not been updated to include it.
 *
 * Uses explicit column selection to avoid pulling internal fields (decoder JS,
 * sample payloads, provenance, notes). RLS policy "Authenticated users can
 * read visible" restricts results to is_visible=true AND deprecated_at IS NULL.
 */
export function useSensorCatalogById(catalogId: string | null) {
  return useQuery<SensorCatalogPublicEntry | null>({
    queryKey: ["sensor-catalog-by-id", catalogId],
    queryFn: async () => {
      if (!catalogId) return null;

      const { data, error } = await supabase
        .from("sensor_catalog")
        .select(
          "id, manufacturer, model, model_variant, display_name, sensor_kind, " +
          "description, frequency_bands, supports_class, f_ports, decoded_fields, " +
          "uplink_info, battery_info, downlink_info, is_supported, tags, " +
          "decode_mode, temperature_unit"
        )
        .eq("id", catalogId)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as unknown as SensorCatalogPublicEntry | null;
    },
    enabled: !!catalogId,
    staleTime: 5 * 60_000, // 5 min — catalog changes rarely
  });
}

/**
 * Hook for super admins to read all catalog entries (including deprecated).
 */
export function useSensorCatalog() {
  return useQuery<SensorCatalogEntry[]>({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sensor_catalog" as any)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("manufacturer", { ascending: true })
        .order("model", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as SensorCatalogEntry[];
    },
    staleTime: 60_000,
  });
}

export function useAddSensorCatalogEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: SensorCatalogInsert) => {
      const { data, error } = await supabase
        .from("sensor_catalog" as any)
        .insert(entry as unknown as Record<string, unknown>)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SensorCatalogEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}

export function useUpdateSensorCatalogEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SensorCatalogEntry> & { id: string }) => {
      const { data, error } = await supabase
        .from("sensor_catalog" as any)
        .update(updates as unknown as Record<string, unknown>)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SensorCatalogEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}

export function useRetireSensorCatalogEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data, error } = await supabase
        .from("sensor_catalog" as any)
        .update({
          deprecated_at: new Date().toISOString(),
          deprecated_reason: reason || null,
          is_visible: false,
        } as unknown as Record<string, unknown>)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SensorCatalogEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}

export function useDeleteSensorCatalogEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sensor_catalog" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}
