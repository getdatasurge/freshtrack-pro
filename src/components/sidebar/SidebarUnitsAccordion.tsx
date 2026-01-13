import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronDown, Thermometer, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavTree, UnitNavItem } from "@/hooks/useNavTree";
import { useSidebarExpandState } from "@/hooks/useSidebarExpandState";
import { useQuickCreateEntityLayout } from "@/hooks/useQuickCreateEntityLayout";
import { LayoutLinksGroup } from "./LayoutLinksGroup";
import { Snowflake, Refrigerator, Box } from "lucide-react";

interface SidebarUnitsAccordionProps {
  organizationId: string | null;
  className?: string;
}

// Map unit type to icon
function getUnitIcon(unitType: string) {
  switch (unitType?.toLowerCase()) {
    case 'freezer':
    case 'walk-in_freezer':
      return Snowflake;
    case 'refrigerator':
    case 'walk-in_cooler':
    case 'cooler':
      return Refrigerator;
    default:
      return Box;
  }
}

/**
 * Units accordion for the sidebar.
 * Shows units with their layouts (Default + custom layouts 1-3).
 */
export function SidebarUnitsAccordion({ organizationId, className }: SidebarUnitsAccordionProps) {
  const params = useParams<{ unitId?: string; layoutKey?: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { sites, isLoading, error } = useNavTree(organizationId);
  const expandState = useSidebarExpandState();
  const createLayoutMutation = useQuickCreateEntityLayout();

  // Flatten all units from all sites for the Units accordion
  const allUnits = useMemo(() => {
    const units: UnitNavItem[] = [];
    for (const site of sites) {
      units.push(...site.units);
    }
    return units.sort((a, b) => a.unitName.localeCompare(b.unitName));
  }, [sites]);

  // Debug logging in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[SidebarUnitsAccordion] render', {
        organizationId,
        unitsCount: allUnits.length,
        unitNames: allUnits.map(u => u.unitName),
        isLoading,
        error: error?.message,
        isUnitsSectionCollapsed: expandState.isUnitsSectionCollapsed,
      });
    }
  }, [organizationId, allUnits, isLoading, error, expandState.isUnitsSectionCollapsed]);

  // Auto-expand to active unit when navigating
  useEffect(() => {
    if (params.unitId && allUnits.length > 0) {
      expandState.expandUnit(params.unitId);
    }
  }, [params.unitId, allUnits.length]);

  // Handler for creating unit layouts with navigation
  const handleCreateUnitLayout = async (unitId: string, slot: 1 | 2 | 3) => {
    if (!organizationId) return;

    const result = await createLayoutMutation.mutateAsync({
      entityType: 'unit',
      entityId: unitId,
      organizationId,
      slotNumber: slot,
    });

    // Navigate to new layout with customize mode
    navigate(`/units/${unitId}/layout/${result.id}?customize=true`);
  };

  // Filter units based on search
  const filteredUnits = allUnits.filter((unit) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return unit.unitName.toLowerCase().includes(q) ||
           unit.siteName.toLowerCase().includes(q) ||
           unit.areaName.toLowerCase().includes(q);
  });

  const isOnUnitsSection = !!params.unitId;

  return (
    <Collapsible
      open={!expandState.isUnitsSectionCollapsed}
      onOpenChange={expandState.toggleUnitsSection}
      className={cn("w-full", className)}
    >
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors w-full text-left",
          isOnUnitsSection && "bg-accent/10 text-accent"
        )}>
          <Thermometer className="h-5 w-5 shrink-0" />
          <span className="font-medium flex-1">Units</span>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
            expandState.isUnitsSectionCollapsed && "-rotate-90"
          )} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="mt-1 ml-2 space-y-1">
          {/* Search - show if more than 5 units */}
          {allUnits.length > 5 && (
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search units..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading units...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="px-3 py-2 text-xs text-destructive">
              Failed to load units
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && allUnits.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No units found
            </div>
          )}

          {/* Units list */}
          {!isLoading && !error && filteredUnits.length > 0 && (
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-0.5 pr-2">
                {filteredUnits.map((unit) => {
                  const IconComponent = getUnitIcon(unit.unitType);

                  return (
                    <Collapsible
                      key={unit.unitId}
                      open={expandState.isUnitExpanded(unit.unitId)}
                      onOpenChange={() => expandState.toggleUnit(unit.unitId)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors w-full text-left",
                          params.unitId === unit.unitId && "bg-accent/10 text-accent font-medium"
                        )}>
                          <IconComponent className="h-4 w-4 shrink-0" />
                          <span className="truncate flex-1">{unit.unitName}</span>
                          <ChevronDown className={cn(
                            "h-3 w-3 text-muted-foreground transition-transform duration-200 shrink-0",
                            !expandState.isUnitExpanded(unit.unitId) && "-rotate-90"
                          )} />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                        <div className="ml-4">
                          <LayoutLinksGroup
                            entityType="unit"
                            entityId={unit.unitId}
                            layouts={unit.layouts}
                            onCreateLayout={(slot) => handleCreateUnitLayout(unit.unitId, slot)}
                            isCreating={createLayoutMutation.isPending}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
