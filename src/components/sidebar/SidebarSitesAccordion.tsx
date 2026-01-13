import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronDown, MapPin, Search, Loader2, Thermometer } from "lucide-react";
import { Snowflake, Refrigerator, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavTree, UnitNavItem } from "@/hooks/useNavTree";
import { useSidebarExpandState } from "@/hooks/useSidebarExpandState";
import { useQuickCreateEntityLayout } from "@/hooks/useQuickCreateEntityLayout";
import { LayoutLinksGroup } from "./LayoutLinksGroup";

interface SidebarSitesAccordionProps {
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

export function SidebarSitesAccordion({ organizationId, className }: SidebarSitesAccordionProps) {
  const params = useParams<{ siteId?: string; unitId?: string; layoutKey?: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { sites, isLoading, error } = useNavTree(organizationId);
  const expandState = useSidebarExpandState();
  const createLayoutMutation = useQuickCreateEntityLayout();

  // Auto-expand to active site/unit when navigating
  useEffect(() => {
    if (params.siteId && sites.length > 0) {
      expandState.expandSite(params.siteId);
    }
    if (params.unitId && sites.length > 0) {
      // Find which site this unit belongs to and expand both
      for (const site of sites) {
        const unit = site.units.find(u => u.unitId === params.unitId);
        if (unit) {
          expandState.expandSite(site.siteId);
          expandState.expandUnit(params.unitId);
          break;
        }
      }
    }
  }, [params.siteId, params.unitId, sites.length]);

  // Handler for creating site layouts with navigation
  const handleCreateSiteLayout = async (siteId: string, slot: 1 | 2 | 3) => {
    if (!organizationId) return;

    const result = await createLayoutMutation.mutateAsync({
      entityType: 'site',
      entityId: siteId,
      organizationId,
      slotNumber: slot,
    });

    // Navigate to new layout with customize mode
    navigate(`/sites/${siteId}/layout/${result.id}?customize=true`);
  };

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

  // Filter sites and units based on search
  const filteredSites = sites.map(site => {
    if (!searchQuery.trim()) return site;

    const q = searchQuery.toLowerCase();
    const siteMatches = site.siteName.toLowerCase().includes(q);
    const matchingUnits = site.units.filter(unit =>
      unit.unitName.toLowerCase().includes(q) ||
      unit.areaName.toLowerCase().includes(q)
    );

    // If site matches, show all its units; if units match, show only those
    if (siteMatches) return site;
    if (matchingUnits.length > 0) {
      return { ...site, units: matchingUnits };
    }
    return null;
  }).filter(Boolean) as typeof sites;

  const isOnSitesSection = !!params.siteId || !!params.unitId;
  const totalItems = sites.reduce((acc, site) => acc + 1 + site.units.length, 0);

  return (
    <Collapsible
      open={!expandState.isSitesSectionCollapsed}
      onOpenChange={expandState.toggleSitesSection}
      className={cn("w-full", className)}
    >
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors w-full text-left",
          isOnSitesSection && "bg-accent/10 text-accent"
        )}>
          <MapPin className="h-5 w-5 shrink-0" />
          <span className="font-medium flex-1">Sites</span>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            expandState.isSitesSectionCollapsed && "-rotate-90"
          )} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 space-y-2">
          {/* Search - show if more than 5 total items */}
          {totalItems > 5 && (
            <div className="px-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search sites & units..."
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
            <div className="px-3 py-2 text-xs text-muted-foreground">No sites found</div>
          )}

          {!isLoading && !error && filteredSites.length > 0 && (
            <ScrollArea className="max-h-[50vh]">
              <div className="px-2 space-y-0.5">
                {filteredSites.map((site) => (
                  <Collapsible
                    key={site.siteId}
                    open={expandState.isSiteExpanded(site.siteId)}
                    onOpenChange={() => expandState.toggleSite(site.siteId)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors w-full text-left",
                        params.siteId === site.siteId && !params.unitId && "bg-accent/10 text-accent"
                      )}>
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate flex-1">{site.siteName}</span>
                        <span className="text-xs text-muted-foreground mr-1">
                          {site.units.length}
                        </span>
                        <ChevronDown className={cn(
                          "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                          !expandState.isSiteExpanded(site.siteId) && "-rotate-90"
                        )} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-4 space-y-0.5">
                        {/* Site Layouts */}
                        <LayoutLinksGroup
                          entityType="site"
                          entityId={site.siteId}
                          layouts={site.layouts}
                          onCreateLayout={(slot) => handleCreateSiteLayout(site.siteId, slot)}
                          isCreating={createLayoutMutation.isPending}
                        />

                        {/* Units under this site */}
                        {site.units.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/30">
                            <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground font-medium">
                              <Thermometer className="h-3 w-3" />
                              <span>Units</span>
                            </div>
                            <div className="space-y-0.5">
                              {site.units.map((unit) => {
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
                                        params.unitId === unit.unitId && "bg-accent/10 text-accent"
                                      )}>
                                        <IconComponent className="h-4 w-4 shrink-0" />
                                        <span className="truncate flex-1">{unit.unitName}</span>
                                        {unit.sensorCount > 0 && (
                                          <span className="text-xs text-muted-foreground mr-1">
                                            {unit.sensorCount}
                                          </span>
                                        )}
                                        <ChevronDown className={cn(
                                          "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                                          !expandState.isUnitExpanded(unit.unitId) && "-rotate-90"
                                        )} />
                                      </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <LayoutLinksGroup
                                        entityType="unit"
                                        entityId={unit.unitId}
                                        layouts={unit.layouts}
                                        onCreateLayout={(slot) => handleCreateUnitLayout(unit.unitId, slot)}
                                        isCreating={createLayoutMutation.isPending}
                                      />
                                    </CollapsibleContent>
                                  </Collapsible>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
