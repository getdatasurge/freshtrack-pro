/**
 * Layout Header Dropdown
 *
 * A compact dropdown for selecting dashboard layouts in page headers.
 * Navigates to the appropriate route when a layout is selected.
 *
 * Permission-gated: Layout creation requires 'layouts.create' permission.
 */

import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout, Lock, Star, ChevronDown, Plus, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuickCreateEntityLayout } from "@/hooks/useQuickCreateEntityLayout";
import { useCan } from "@/hooks/useCan";

interface LayoutHeaderDropdownProps {
  entityType: "site" | "unit";
  entityId: string;
  organizationId: string;
  currentLayoutKey: string; // 'default' or layoutId
}

interface LayoutRecord {
  id: string;
  name: string;
  slot_number: number;
  is_user_default: boolean;
}

export function LayoutHeaderDropdown({
  entityType,
  entityId,
  organizationId,
  currentLayoutKey,
}: LayoutHeaderDropdownProps) {
  const navigate = useNavigate();
  const createLayoutMutation = useQuickCreateEntityLayout();
  const { allowed: canCreateLayouts } = useCan('layouts.create');

  // Fetch layouts for this entity
  const { data: layouts = [], isLoading } = useQuery({
    queryKey: ["entity-layouts-header", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entity_dashboard_layouts")
        .select("id, name, slot_number, is_user_default")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("slot_number", { ascending: true });

      if (error) throw error;
      return (data || []) as LayoutRecord[];
    },
    enabled: !!entityId,
    staleTime: 1000 * 30,
  });

  const basePath = entityType === "site" ? `/sites/${entityId}` : `/units/${entityId}`;

  const handleSelectLayout = (layoutId: string | "default") => {
    if (layoutId === "default") {
      navigate(basePath);
    } else {
      navigate(`${basePath}/layout/${layoutId}`);
    }
  };

  const handleCreateLayout = async () => {
    // Find next available slot
    const usedSlots = new Set(layouts.map(l => l.slot_number));
    let nextSlot: 1 | 2 | 3 = 1;
    if (usedSlots.has(1)) nextSlot = 2;
    if (usedSlots.has(2)) nextSlot = 3;
    if (usedSlots.has(3)) return; // Max layouts reached

    try {
      const result = await createLayoutMutation.mutateAsync({
        entityType,
        entityId,
        organizationId,
        slotNumber: nextSlot,
      });
      navigate(`${basePath}/layout/${result.id}?customize=true`);
    } catch (error) {
      console.error("Failed to create layout:", error);
    }
  };

  const isDefault = currentLayoutKey === "default";
  const currentLayout = layouts.find(l => l.id === currentLayoutKey);
  const currentName = isDefault ? "Default" : (currentLayout?.name || "Layout");
  // Only show create option if user has permission AND slots available
  const canCreateMore = canCreateLayouts && layouts.length < 3;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Layout className="w-3.5 h-3.5" />
          )}
          <span className="truncate max-w-[120px]">{currentName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {/* Default Layout */}
        <DropdownMenuItem
          onClick={() => handleSelectLayout("default")}
          className={cn(isDefault && "bg-accent/10")}
        >
          <Lock className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
          <span>Default</span>
        </DropdownMenuItem>

        {/* Custom Layouts */}
        {layouts.length > 0 && <DropdownMenuSeparator />}
        {layouts.map((layout) => (
          <DropdownMenuItem
            key={layout.id}
            onClick={() => handleSelectLayout(layout.id)}
            className={cn(currentLayoutKey === layout.id && "bg-accent/10")}
          >
            <Layout className="w-3.5 h-3.5 mr-2" />
            <span className="truncate flex-1">{layout.name}</span>
            {layout.is_user_default && (
              <Star className="w-3 h-3 text-amber-500 fill-amber-500 ml-auto" />
            )}
          </DropdownMenuItem>
        ))}

        {/* Create New */}
        {canCreateMore && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleCreateLayout}
              disabled={createLayoutMutation.isPending}
            >
              {createLayoutMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5 mr-2" />
              )}
              <span>New Layout ({layouts.length}/3)</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
