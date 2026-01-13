import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronDown, MapPin, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavTree } from "@/hooks/useNavTree";
import { useSidebarExpandState } from "@/hooks/useSidebarExpandState";
import { useQuickCreateEntityLayout } from "@/hooks/useQuickCreateEntityLayout";
import { LayoutLinksGroup } from "./LayoutLinksGroup";

interface SidebarSitesAccordionProps {
  organizationId: string | null;
  className?: string;
}

/**
 * Sites accordion for the sidebar.
 * Shows sites with their layouts (Default + custom layouts 1-3).
 */
export function SidebarSitesAccordion({ organizationId, className }: SidebarSitesAccordionProps) {
  const params = useParams<{ siteId?: string; unitId?: string; layoutKey?: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { sites, isLoading, error } = useNavTree(organizationId);
  const expandState = useSidebarExpandState();
  const createLayoutMutation = useQuickCreateEntityLayout();

  // Debug logging in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[SidebarSitesAccordion] render', {
        organizationId,
        sitesCount: sites.length,
        siteNames: sites.map(s => s.siteName),
        isLoading,
        error: error?.message,
        isSitesSectionCollapsed: expandState.isSitesSectionCollapsed,
      });
    }
  }, [organizationId, sites, isLoading, error, expandState.isSitesSectionCollapsed]);

  // Auto-expand to active site when navigating
  useEffect(() => {
    if (params.siteId && sites.length > 0) {
      expandState.expandSite(params.siteId);
    }
  }, [params.siteId, sites.length]);

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

  // Filter sites based on search
  const filteredSites = searchQuery.trim()
    ? sites.filter(site => site.siteName.toLowerCase().includes(searchQuery.toLowerCase()))
    : sites;

  const isOnSitesSection = !!params.siteId && !params.unitId;

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
            "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
            expandState.isSitesSectionCollapsed && "-rotate-90"
          )} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="mt-1 ml-2 space-y-1">
          {/* Search - show if more than 5 sites */}
          {sites.length > 5 && (
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search sites..."
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
              <span>Loading sites...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="px-3 py-2 text-xs text-destructive">
              Failed to load sites
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && sites.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No sites found
            </div>
          )}

          {/* Sites list */}
          {!isLoading && !error && filteredSites.length > 0 && (
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-0.5 pr-2">
                {filteredSites.map((site) => (
                  <Collapsible
                    key={site.siteId}
                    open={expandState.isSiteExpanded(site.siteId)}
                    onOpenChange={() => expandState.toggleSite(site.siteId)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors w-full text-left",
                        params.siteId === site.siteId && !params.unitId && "bg-accent/10 text-accent font-medium"
                      )}>
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate flex-1">{site.siteName}</span>
                        <ChevronDown className={cn(
                          "h-3 w-3 text-muted-foreground transition-transform duration-200 shrink-0",
                          !expandState.isSiteExpanded(site.siteId) && "-rotate-90"
                        )} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                      <div className="ml-4">
                        <LayoutLinksGroup
                          entityType="site"
                          entityId={site.siteId}
                          layouts={site.layouts}
                          onCreateLayout={(slot) => handleCreateSiteLayout(site.siteId, slot)}
                          isCreating={createLayoutMutation.isPending}
                        />
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
