import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SavedLayout, LayoutConfig, TimelineState, WidgetPreferences } from "../types";
import { MAX_CUSTOM_LAYOUTS } from "../types";

interface LayoutRow {
  id: string;
  organization_id: string;
  sensor_id: string;
  user_id: string;
  name: string;
  is_user_default: boolean;
  layout_json: LayoutConfig;
  widget_prefs_json: WidgetPreferences;
  timeline_state_json: TimelineState;
  layout_version: number;
  created_at: string;
  updated_at: string;
}

function rowToSavedLayout(row: LayoutRow): SavedLayout {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sensorId: row.sensor_id,
    userId: row.user_id,
    name: row.name,
    isUserDefault: row.is_user_default,
    layoutJson: row.layout_json,
    widgetPrefsJson: row.widget_prefs_json,
    timelineStateJson: row.timeline_state_json,
    layoutVersion: row.layout_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Hook for persisting sensor dashboard layouts.
 * Layouts are scoped per sensor (not per unit).
 */
export function useLayoutStorage(sensorId: string | undefined, organizationId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["sensor-dashboard-layouts", sensorId];

  // Fetch saved layouts for this sensor
  const { data: savedLayouts, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!sensorId) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("sensor_dashboard_layouts")
        .select("*")
        .eq("sensor_id", sensorId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[useLayoutStorage] Error fetching layouts:", error);
        throw error;
      }

      return (data || []).map((row) => rowToSavedLayout(row as unknown as LayoutRow));
    },
    enabled: !!sensorId,
  });

  // Save a new layout
  const saveLayoutMutation = useMutation({
    mutationFn: async (params: {
      name: string;
      layoutJson: LayoutConfig;
      widgetPrefsJson?: WidgetPreferences;
      timelineStateJson?: TimelineState;
      isUserDefault?: boolean;
    }) => {
      if (!sensorId || !organizationId) {
        throw new Error("Missing sensor or organization ID");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const insertData = {
        organization_id: organizationId,
        sensor_id: sensorId,
        user_id: user.id,
        name: params.name,
        layout_json: params.layoutJson,
        widget_prefs_json: params.widgetPrefsJson || {},
        timeline_state_json: params.timelineStateJson || {},
        is_user_default: params.isUserDefault || false,
      };

      const { data, error } = await supabase
        .from("sensor_dashboard_layouts")
        .insert(insertData as never)
        .select()
        .single();

      if (error) throw error;
      return rowToSavedLayout(data as unknown as LayoutRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Layout saved");
    },
    onError: (error: Error) => {
      console.error("[useLayoutStorage] Save error:", error);
      if (error.message.includes("Maximum of 3 custom layouts")) {
        toast.error("Maximum 3 layouts per sensor allowed");
      } else {
        toast.error("Failed to save layout");
      }
    },
  });

  // Update an existing layout
  const updateLayoutMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      layoutJson?: LayoutConfig;
      widgetPrefsJson?: WidgetPreferences;
      timelineStateJson?: TimelineState;
      isUserDefault?: boolean;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (params.name !== undefined) updateData.name = params.name;
      if (params.layoutJson !== undefined) updateData.layout_json = params.layoutJson;
      if (params.widgetPrefsJson !== undefined) updateData.widget_prefs_json = params.widgetPrefsJson;
      if (params.timelineStateJson !== undefined) updateData.timeline_state_json = params.timelineStateJson;
      if (params.isUserDefault !== undefined) updateData.is_user_default = params.isUserDefault;

      const { data, error } = await supabase
        .from("sensor_dashboard_layouts")
        .update(updateData)
        .eq("id", params.id)
        .select()
        .single();

      if (error) throw error;
      return rowToSavedLayout(data as unknown as LayoutRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      console.error("[useLayoutStorage] Update error:", error);
      toast.error("Failed to update layout");
    },
  });

  // Delete a layout
  const deleteLayoutMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sensor_dashboard_layouts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Layout deleted");
    },
    onError: (error: Error) => {
      console.error("[useLayoutStorage] Delete error:", error);
      toast.error("Failed to delete layout");
    },
  });

  // Set a layout as user default (unsets others)
  const setAsDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !sensorId) throw new Error("Not authenticated");

      // First, unset all defaults for this user/sensor
      await supabase
        .from("sensor_dashboard_layouts")
        .update({ is_user_default: false })
        .eq("sensor_id", sensorId)
        .eq("user_id", user.id);

      // Then set the new default
      const { error } = await supabase
        .from("sensor_dashboard_layouts")
        .update({ is_user_default: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Default layout updated");
    },
    onError: (error: Error) => {
      console.error("[useLayoutStorage] Set default error:", error);
      toast.error("Failed to set default layout");
    },
  });

  return {
    savedLayouts: savedLayouts || [],
    isLoading,
    error,
    saveLayout: saveLayoutMutation.mutateAsync,
    updateLayout: updateLayoutMutation.mutateAsync,
    deleteLayout: deleteLayoutMutation.mutateAsync,
    setAsUserDefault: setAsDefaultMutation.mutateAsync,
    isSaving: saveLayoutMutation.isPending,
    isUpdating: updateLayoutMutation.isPending,
    isDeleting: deleteLayoutMutation.isPending,
    layoutCount: savedLayouts?.length || 0,
    canCreateNew: (savedLayouts?.length || 0) < MAX_CUSTOM_LAYOUTS,
  };
}
