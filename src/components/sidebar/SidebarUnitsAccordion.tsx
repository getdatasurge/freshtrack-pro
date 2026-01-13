import { useEffect, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { ChevronDown, Boxes, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUnitsNavTree } from "@/hooks/useUnitsNavTree";
import { useSidebarExpandState } from "@/hooks/useSidebarExpandState";
import { UnitAccordionItem } from "./UnitAccordionItem";

interface SidebarUnitsAccordionProps {
  organizationId: string | null;
  className?: string;
}

export function SidebarUnitsAccordion({ organizationId, className }: SidebarUnitsAccordionProps) {
  const location = useLocation();
  const params = useParams<{ unitId: string }>();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");

  const { units, isLoading, error } = useUnitsNavTree(organizationId);
  const expandState = useSidebarExpandState();

  // Auto-expand to active unit/sensor when navigating
  useEffect(() => {
    if (params.unitId && units.length > 0) {
      const currentSensorId = searchParams.get("sensor");
      expandState.expandToActive(params.unitId, currentSensorId || undefined);
    }
  }, [params.unitId, searchParams, units.length]);

  // Filter units based on search query
  const filteredUnits = units.filter((unit) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    
    // Match unit name
    if (unit.unitName.toLowerCase().includes(query)) return true;
    
    // Match sensor names within unit
    if (unit.sensors.some((s) => s.sensorName.toLowerCase().includes(query))) return true;
    
    // Match site/area names
    if (unit.siteName.toLowerCase().includes(query)) return true;
    if (unit.areaName.toLowerCase().includes(query)) return true;
    
    return false;
  });

  // Check if current path starts with /units
  const isOnUnitsSection = location.pathname.startsWith("/units");

  return (
    <Collapsible
      open={!expandState.isUnitsSectionCollapsed}
      onOpenChange={expandState.toggleUnitsSection}
      className={cn("w-full", className)}
    >
      <CollapsibleTrigger className="w-full">
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors w-full text-left",
            isOnUnitsSection && "bg-accent/10 text-accent"
          )}
        >
          <Boxes className="h-5 w-5 shrink-0" />
          <span className="font-medium flex-1">Units</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform shrink-0",
              expandState.isUnitsSectionCollapsed && "-rotate-90"
            )}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 space-y-2">
          {/* Search Input */}
          {units.length > 5 && (
            <div className="px-3">
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

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="px-3 py-2 text-xs text-destructive">
              Failed to load units
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && units.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No units found
            </div>
          )}

          {/* Units List */}
          {!isLoading && !error && filteredUnits.length > 0 && (
            <ScrollArea className="max-h-[45vh]">
              <div className="px-2 space-y-0.5">
                {filteredUnits.map((unit) => (
                  <UnitAccordionItem
                    key={unit.unitId}
                    unit={unit}
                    organizationId={organizationId || ""}
                    isExpanded={expandState.isUnitExpanded(unit.unitId)}
                    onToggle={() => expandState.toggleUnit(unit.unitId)}
                    isSensorExpanded={expandState.isSensorExpanded}
                    onToggleSensor={expandState.toggleSensor}
                  />
                ))}
              </div>
            </ScrollArea>
          )}

          {/* No Results */}
          {!isLoading && searchQuery && filteredUnits.length === 0 && units.length > 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No matches for "{searchQuery}"
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
