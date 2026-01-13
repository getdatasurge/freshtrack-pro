import { ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LayoutLinksGroup } from "./LayoutLinksGroup";
import { UnitAccordionItem } from "./UnitAccordionItem";
import type { SiteNavItem } from "@/hooks/useNavTree";
import { useQuickCreateEntityLayout } from "@/hooks/useQuickCreateEntityLayout";

interface SiteAccordionItemProps {
  site: SiteNavItem;
  organizationId: string;
  isExpanded: boolean;
  expandedUnits: Set<string>;
  onToggle: () => void;
  onToggleUnit: (unitId: string) => void;
}

/**
 * Site accordion item with layouts and nested units
 */
export function SiteAccordionItem({
  site,
  organizationId,
  isExpanded,
  expandedUnits,
  onToggle,
  onToggleUnit,
}: SiteAccordionItemProps) {
  const createLayoutMutation = useQuickCreateEntityLayout();

  const handleCreateLayout = (slot: 1 | 2 | 3) => {
    createLayoutMutation.mutate({
      entityType: 'site',
      entityId: site.siteId,
      organizationId,
      slotNumber: slot,
    });
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors group">
          <ChevronRight
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform shrink-0",
              isExpanded && "rotate-90"
            )}
          />
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate flex-1 text-left">
            {site.siteName}
          </span>
          <span className="text-xs text-muted-foreground">
            {site.units.length} units
          </span>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-4 border-l border-border/50 pl-2 space-y-1 py-1">
          {/* Site Layouts */}
          <LayoutLinksGroup
            entityType="site"
            entityId={site.siteId}
            layouts={site.layouts}
            onCreateLayout={handleCreateLayout}
            isCreating={createLayoutMutation.isPending}
          />

          {/* Nested Units */}
          {site.units.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {site.units.map((unit) => (
                <UnitAccordionItem
                  key={unit.unitId}
                  unit={unit}
                  organizationId={organizationId}
                  isExpanded={expandedUnits.has(unit.unitId)}
                  onToggle={() => onToggleUnit(unit.unitId)}
                />
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
