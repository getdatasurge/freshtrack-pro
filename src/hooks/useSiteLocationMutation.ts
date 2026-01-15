/**
 * Site Location Mutation Hook
 * 
 * React Query mutation for updating site latitude, longitude, and timezone.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SiteLocationData {
  latitude: number;
  longitude: number;
  timezone: string;
}

export function useSiteLocationMutation(siteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SiteLocationData) => {
      const { error } = await supabase
        .from("sites")
        .update({
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone,
        })
        .eq("id", siteId);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["site", siteId] });
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["weather", siteId] });
      toast.success("Site location updated successfully");
    },
    onError: (error) => {
      console.error("Failed to update site location:", error);
      toast.error("Failed to update site location");
    },
  });
}
