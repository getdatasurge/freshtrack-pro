import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEFAULT_LAYOUT_CONFIG, DEFAULT_TIMELINE_STATE } from "@/features/dashboard-layout/constants/defaultLayout";

interface CreateLayoutParams {
  sensorId: string;
  organizationId: string;
  slotNumber: 1 | 2 | 3;
  name?: string;
}

interface CreatedLayout {
  id: string;
  name: string;
  sensorId: string;
}

/**
 * Hook for quickly creating a new layout from the sidebar.
 * Creates a layout with default configuration.
 */
export function useQuickCreateLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateLayoutParams): Promise<CreatedLayout> => {
      const { sensorId, organizationId, slotNumber, name } = params;
      
      const layoutName = name || `Layout ${slotNumber}`;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const insertData = {
        organization_id: organizationId,
        sensor_id: sensorId,
        user_id: user.id,
        name: layoutName,
        layout_json: DEFAULT_LAYOUT_CONFIG,
        widget_prefs_json: {},
        timeline_state_json: DEFAULT_TIMELINE_STATE,
        is_user_default: false,
      };

      const { data, error } = await supabase
        .from("sensor_dashboard_layouts")
        .insert(insertData as never)
        .select()
        .single();

      if (error) {
        if (error.message?.includes("Maximum of 3 custom layouts")) {
          throw new Error("Maximum 3 layouts per sensor allowed");
        }
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        sensorId: data.sensor_id,
      };
    },
    onSuccess: (data) => {
      // Invalidate navigation tree and layouts
      queryClient.invalidateQueries({ queryKey: ["nav-layouts"] });
      queryClient.invalidateQueries({ queryKey: ["sensor-dashboard-layouts", data.sensorId] });
      toast.success(`Created "${data.name}"`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create layout");
    },
  });
}
