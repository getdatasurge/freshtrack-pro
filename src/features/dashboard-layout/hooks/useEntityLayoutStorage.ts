import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LayoutConfig, TimelineState, WidgetPreferences, SavedLayout } from "../types";
import { DEFAULT_LAYOUT_CONFIG, DEFAULT_TIMELINE_STATE } from "../constants/defaultLayout";
import { Json } from "@/integrations/supabase/types";

export type EntityType = 'unit' | 'site';

interface EntityLayoutRow {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  slot_number: number;
  name: string;
  is_user_default: boolean;
  layout_json: Json;
  widget_prefs_json: Json;
  timeline_state_json: Json;
  layout_version: number;
  created_at: string;
  updated_at: string;
}

function rowToSavedLayout(row: EntityLayoutRow): SavedLayout {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sensorId: row.entity_id, // For backward compatibility - actually entityId
    userId: row.user_id,
    name: row.name,
    isUserDefault: row.is_user_default,
    layoutJson: row.layout_json as unknown as LayoutConfig,
    widgetPrefsJson: (row.widget_prefs_json || {}) as unknown as WidgetPreferences,
    timelineStateJson: (row.timeline_state_json || DEFAULT_TIMELINE_STATE) as unknown as TimelineState,
    layoutVersion: row.layout_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface EntityLayoutSlot {
  slotNumber: 1 | 2 | 3;
  layoutId: string | null;
  name: string;
  isUserDefault: boolean;
}

/**
 * Hook for managing entity (unit or site) dashboard layouts.
 */
export function useEntityLayoutStorage(
  entityType: EntityType,
  entityId: string | undefined,
  organizationId: string | undefined
) {
  const queryClient = useQueryClient();
  const queryKey = ["entity-layouts", entityType, entityId];

  // Fetch saved layouts for this entity
  const { data: savedLayouts = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !entityId) return [];

      const { data, error } = await supabase
        .from("entity_dashboard_layouts")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("user_id", user.id)
        .order("slot_number", { ascending: true });

      if (error) {
        console.error("Error fetching entity layouts:", error);
        return [];
      }

      return (data as EntityLayoutRow[]).map(rowToSavedLayout);
    },
    enabled: !!entityId,
    staleTime: 1000 * 60, // 1 minute
  });

  // Get layouts mapped by slot number
  const layoutBySlot = (slot: 1 | 2 | 3): SavedLayout | null => {
    const layouts = savedLayouts as SavedLayout[];
    return layouts.find((l, idx) => {
      // Slot number is stored in DB, but also we can use index + 1
      const row = (l as any);
      // Check if we can access slot_number from the underlying data
      // Since we order by slot_number, slot 1 = index 0, etc.
      return idx + 1 === slot;
    }) || null;
  };

  // Check if a slot has a layout
  const hasSlot = (slot: 1 | 2 | 3): boolean => {
    return savedLayouts.length >= slot;
  };

  // Get next available slot number
  const nextAvailableSlot = (): 1 | 2 | 3 | null => {
    const count = savedLayouts.length;
    if (count >= 3) return null;
    return (count + 1) as 1 | 2 | 3;
  };

  // Save new layout mutation
  const saveLayoutMutation = useMutation({
    mutationFn: async (params: {
      slotNumber: 1 | 2 | 3;
      name: string;
      layoutJson?: LayoutConfig;
      widgetPrefsJson?: WidgetPreferences;
      timelineStateJson?: TimelineState;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !entityId || !organizationId) {
        throw new Error("Not authenticated or missing entity/org");
      }

      const insertData = {
        organization_id: organizationId,
        entity_type: entityType,
        entity_id: entityId,
        user_id: user.id,
        slot_number: params.slotNumber,
        name: params.name,
        layout_json: (params.layoutJson || DEFAULT_LAYOUT_CONFIG) as unknown as import("@/integrations/supabase/types").Json,
        widget_prefs_json: (params.widgetPrefsJson || {}) as unknown as import("@/integrations/supabase/types").Json,
        timeline_state_json: (params.timelineStateJson || DEFAULT_TIMELINE_STATE) as unknown as import("@/integrations/supabase/types").Json,
        is_user_default: false,
      };

      const { data, error } = await supabase
        .from("entity_dashboard_layouts")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        if (error.message?.includes("Maximum of 3")) {
          throw new Error("Maximum 3 layouts per entity allowed");
        }
        throw error;
      }

      return rowToSavedLayout(data as EntityLayoutRow);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["nav-tree"] });
      queryClient.invalidateQueries({ queryKey: ["nav-tree-layouts"] });
      queryClient.invalidateQueries({ queryKey: ["nav-tree-units"] });
      toast.success(`Layout "${data.name}" created`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create layout");
    },
  });

  // Update layout mutation
  const updateLayoutMutation = useMutation({
    mutationFn: async (params: {
      layoutId: string;
      name?: string;
      layoutJson?: LayoutConfig;
      widgetPrefsJson?: WidgetPreferences;
      timelineStateJson?: TimelineState;
    }) => {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (params.name !== undefined) updates.name = params.name;
      if (params.layoutJson !== undefined) updates.layout_json = params.layoutJson;
      if (params.widgetPrefsJson !== undefined) updates.widget_prefs_json = params.widgetPrefsJson;
      if (params.timelineStateJson !== undefined) updates.timeline_state_json = params.timelineStateJson;

      const { data, error } = await supabase
        .from("entity_dashboard_layouts")
        .update(updates)
        .eq("id", params.layoutId)
        .select()
        .single();

      if (error) throw error;
      return rowToSavedLayout(data as EntityLayoutRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["nav-tree"] });
      queryClient.invalidateQueries({ queryKey: ["nav-tree-layouts"] });
      queryClient.invalidateQueries({ queryKey: ["nav-tree-units"] });
      toast.success("Layout saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save layout");
    },
  });

  // Delete layout mutation
  const deleteLayoutMutation = useMutation({
    mutationFn: async (layoutId: string) => {
      const { error } = await supabase
        .from("entity_dashboard_layouts")
        .delete()
        .eq("id", layoutId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["nav-tree"] });
      queryClient.invalidateQueries({ queryKey: ["nav-tree-layouts"] });
      queryClient.invalidateQueries({ queryKey: ["nav-tree-units"] });
      toast.success("Layout deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete layout");
    },
  });

  // Set as default mutation
  const setAsDefaultMutation = useMutation({
    mutationFn: async (layoutId: string) => {
      const { error } = await supabase
        .from("entity_dashboard_layouts")
        .update({ is_user_default: true })
        .eq("id", layoutId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Set as default layout");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to set default");
    },
  });

  return {
    savedLayouts: savedLayouts as SavedLayout[],
    isLoading,
    layoutBySlot,
    hasSlot,
    nextAvailableSlot,
    layoutCount: savedLayouts.length,
    canCreateNew: savedLayouts.length < 3,
    saveLayout: saveLayoutMutation.mutateAsync,
    updateLayout: updateLayoutMutation.mutateAsync,
    deleteLayout: deleteLayoutMutation.mutateAsync,
    setAsUserDefault: setAsDefaultMutation.mutateAsync,
    isSaving: saveLayoutMutation.isPending,
    isUpdating: updateLayoutMutation.isPending,
    isDeleting: deleteLayoutMutation.isPending,
  };
}
