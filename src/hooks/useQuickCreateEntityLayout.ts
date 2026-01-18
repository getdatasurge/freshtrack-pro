import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEFAULT_LAYOUT_CONFIG, DEFAULT_TIMELINE_STATE } from "@/features/dashboard-layout/constants/defaultLayout";
import { qk } from "@/lib/queryKeys";
import { invalidateLayouts } from "@/lib/invalidation";

export type EntityType = 'unit' | 'site';

interface CreateLayoutParams {
  entityType: EntityType;
  entityId: string;
  organizationId: string;
  slotNumber: 1 | 2 | 3;
  name?: string;
}

interface CreatedLayout {
  id: string;
  name: string;
  entityType: EntityType;
  entityId: string;
  slotNumber: 1 | 2 | 3;
}

/**
 * Hook for quickly creating a new layout from the sidebar.
 * Creates a layout with default configuration for either a unit or site.
 */
export function useQuickCreateEntityLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateLayoutParams): Promise<CreatedLayout> => {
      const { entityType, entityId, organizationId, slotNumber, name } = params;
      
      const layoutName = name || `Layout ${slotNumber}`;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const insertData = {
        organization_id: organizationId,
        entity_type: entityType,
        entity_id: entityId,
        user_id: user.id,
        slot_number: slotNumber,
        name: layoutName,
        layout_json: DEFAULT_LAYOUT_CONFIG as unknown as import("@/integrations/supabase/types").Json,
        widget_prefs_json: {} as unknown as import("@/integrations/supabase/types").Json,
        timeline_state_json: DEFAULT_TIMELINE_STATE as unknown as import("@/integrations/supabase/types").Json,
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

      return {
        id: data.id,
        name: data.name,
        entityType: data.entity_type as EntityType,
        entityId: data.entity_id,
        slotNumber: data.slot_number as 1 | 2 | 3,
      };
    },
    onSuccess: async (data, variables) => {
      // Use centralized layout invalidation
      await invalidateLayouts(
        queryClient,
        data.entityType,
        data.entityId,
        variables.organizationId
      );
      toast.success(`Created "${data.name}"`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create layout");
    },
  });
}
