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
        .from("sensor_catalog_public")
        .select("*");

      if (error) throw error;
      return (data ?? []) as unknown as SensorCatalogPublicEntry[];
    },
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
        .from("sensor_catalog")
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
        .from("sensor_catalog")
        .insert(entry as Record<string, unknown>)
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
        .from("sensor_catalog")
        .update(updates as Record<string, unknown>)
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
        .from("sensor_catalog")
        .update({
          deprecated_at: new Date().toISOString(),
          deprecated_reason: reason || null,
          is_visible: false,
        } as Record<string, unknown>)
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
        .from("sensor_catalog")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}
