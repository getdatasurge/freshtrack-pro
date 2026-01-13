import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronDown, Boxes, Search, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useNavTree } from "@/hooks/useNavTree";
import { useSidebarExpandState } from "@/hooks/useSidebarExpandState";
import { useQuickCreateEntityLayout } from "@/hooks/useQuickCreateEntityLayout";
import { UnitAccordionItem } from "./UnitAccordionItem";
import { SiteAccordionItem } from "./SiteAccordionItem";
import { LayoutLinksGroup } from "./LayoutLinksGroup";

interface SidebarUnitsAccordionProps {
  organizationId: string | null;
  className?: string;
}

export function SidebarUnitsAccordion({ organizationId, className }: SidebarUnitsAccordionProps) {
  const params = useParams<{ unitId?: string; siteId?: string; layoutKey?: string }>();
  const [searchQuery, setSearchQuery] = useState("");

  const { sites, hasSingleSite, isLoading, error } = useNavTree(organizationId);
  const expandState = useSidebarExpandState();
  const createLayoutMutation = useQuickCreateEntityLayout();

  // Auto-expand to active entity when navigating
  useEffect(() => {
    // Handle unit routes - expand parent site and unit
    if (params.unitId && sites.length > 0) {
      const siteWithUnit = sites.find(s => s.units.some(u => u.unitId === params.unitId));
      expandState.expandToActive(params.unitId, siteWithUnit?.siteId);
    }
    
    // Handle site routes - expand the site accordion
    if (params.siteId && sites.length > 0) {
      expandState.expandToActiveSite(params.siteId);
    }
  }, [params.unitId, params.siteId, sites.length]);

  // Handler for creating site layouts
  const handleCreateSiteLayout = (siteId: string, slot: 1 | 2 | 3) => {
    if (!organizationId) return;
    createLayoutMutation.mutate({
      entityType: 'site',
      entityId: siteId,
      organizationId,
      slotNumber: slot,
    });
  };

  // Filter sites/units based on search
  const filteredSites = sites.map((site) => ({
    ...site,
    units: site.units.filter((unit) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return unit.unitName.toLowerCase().includes(q) || 
             site.siteName.toLowerCase().includes(q) ||
             unit.areaName.toLowerCase().includes(q);
    }),
  })).filter((site) => site.units.length > 0 || site.siteName.toLowerCase().includes(searchQuery.toLowerCase()));

  const totalUnits = sites.reduce((sum, s) => sum + s.units.length, 0);
  const isOnEquipmentSection = params.unitId || params.siteId;

  return (
    <Collapsible
      open={!expandState.isUnitsSectionCollapsed}
      onOpenChange={expandState.toggleUnitsSection}
      className={cn("w-full", className)}
    >
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors w-full text-left",
          isOnEquipmentSection && "bg-accent/10 text-accent"
        )}>
          <Boxes className="h-5 w-5 shrink-0" />
          <span className="font-medium flex-1">Equipment</span>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            expandState.isUnitsSectionCollapsed && "-rotate-90"
          )} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 space-y-2">
          {totalUnits > 5 && (
            <div className="px-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && <div className="px-3 py-2 text-xs text-destructive">Failed to load</div>}

          {!isLoading && !error && sites.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No equipment found</div>
          )}

          {!isLoading && !error && filteredSites.length > 0 && (
            <ScrollArea className="max-h-[45vh]">
              <div className="px-2 space-y-0.5">
                {hasSingleSite ? (
                  // Single site: show site layouts THEN units
                  <>
                    {/* Site Layouts for single-site org */}
                    <div className="mb-2">
                      <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground uppercase tracking-wider">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{filteredSites[0].siteName}</span>
                      </div>
                      <LayoutLinksGroup
                        entityType="site"
                        entityId={filteredSites[0].siteId}
                        layouts={filteredSites[0].layouts}
                        onCreateLayout={(slot) => handleCreateSiteLayout(filteredSites[0].siteId, slot)}
                        isCreating={createLayoutMutation.isPending}
                      />
                    </div>
                    
                    <Separator className="my-2" />
                    
                    {/* Units header */}
                    <div className="text-xs text-muted-foreground uppercase tracking-wider px-3 py-1 mb-1">
                      Units
                    </div>
                    
                    {/* Units list */}
                    {filteredSites[0].units.map((unit) => (
                      <UnitAccordionItem
                        key={unit.unitId}
                        unit={unit}
                        organizationId={organizationId || ""}
                        isExpanded={expandState.isUnitExpanded(unit.unitId)}
                        onToggle={() => expandState.toggleUnit(unit.unitId)}
                      />
                    ))}
                  </>
                ) : (
                  // Multiple sites: show site accordion with nested units
                  filteredSites.map((site) => (
                    <SiteAccordionItem
                      key={site.siteId}
                      site={site}
                      organizationId={organizationId || ""}
                      isExpanded={expandState.isSiteExpanded(site.siteId)}
                      expandedUnits={new Set(site.units.filter(u => expandState.isUnitExpanded(u.unitId)).map(u => u.unitId))}
                      onToggle={() => expandState.toggleSite(site.siteId)}
                      onToggleUnit={(unitId) => expandState.toggleUnit(unitId)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
