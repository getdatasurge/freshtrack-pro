import { ChevronRight, Thermometer, Snowflake, Sun, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LayoutLinksGroup } from "./LayoutLinksGroup";
import type { UnitNavItem } from "@/hooks/useNavTree";
import { useQuickCreateEntityLayout } from "@/hooks/useQuickCreateEntityLayout";
import { useParams } from "react-router-dom";

interface UnitAccordionItemProps {
  unit: UnitNavItem;
  organizationId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function getUnitIcon(unitType: string) {
  switch (unitType) {
    case "freezer": return Snowflake;
    case "cooler":
    case "refrigerator": return Thermometer;
    case "hot_holding": return Sun;
    default: return Box;
  }
}

export function UnitAccordionItem({
  unit,
  organizationId,
  isExpanded,
  onToggle,
}: UnitAccordionItemProps) {
  const { unitId: activeUnitId } = useParams<{ unitId?: string }>();
  const createLayoutMutation = useQuickCreateEntityLayout();
  const UnitIcon = getUnitIcon(unit.unitType);
  const isActive = activeUnitId === unit.unitId;

  const handleCreateLayout = (slot: 1 | 2 | 3) => {
    createLayoutMutation.mutate({
      entityType: 'unit',
      entityId: unit.unitId,
      organizationId,
      slotNumber: slot,
    });
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors group",
          isActive && "bg-accent"
        )}>
          <ChevronRight className={cn(
            "w-4 h-4 text-muted-foreground transition-transform shrink-0",
            isExpanded && "rotate-90"
          )} />
          <UnitIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate flex-1 text-left">{unit.unitName}</span>
          {unit.sensorCount > 0 && (
            <span className="text-xs text-muted-foreground">{unit.sensorCount}</span>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 border-l border-border/50 pl-2 py-1">
          <LayoutLinksGroup
            entityType="unit"
            entityId={unit.unitId}
            layouts={unit.layouts}
            onCreateLayout={handleCreateLayout}
            isCreating={createLayoutMutation.isPending}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
