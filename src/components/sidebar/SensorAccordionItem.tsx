import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ChevronRight, Thermometer, Plus, LayoutGrid, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useQuickCreateLayout } from "@/hooks/useQuickCreateLayout";
import type { SensorNavItem } from "@/hooks/useUnitsNavTree";

interface SensorAccordionItemProps {
  sensor: SensorNavItem;
  unitId: string;
  organizationId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export function SensorAccordionItem({
  sensor,
  unitId,
  organizationId,
  isExpanded,
  onToggle,
}: SensorAccordionItemProps) {
  const location = useLocation();
  const params = useParams<{ unitId: string }>();
  const searchParams = new URLSearchParams(location.search);
  const currentSensorId = searchParams.get("sensor");
  const currentLayoutKey = searchParams.get("layout") || "default";
  const createLayout = useQuickCreateLayout();

  const isOnThisUnit = params.unitId === unitId;
  const isThisSensorActive = isOnThisUnit && currentSensorId === sensor.sensorId;

  const buildLayoutUrl = (layoutKey: string) => {
    const params = new URLSearchParams();
    params.set("sensor", sensor.sensorId);
    if (layoutKey !== "default") {
      params.set("layout", layoutKey);
    }
    return `/units/${unitId}?${params.toString()}`;
  };

  const isLayoutActive = (layoutKey: string) => {
    if (!isThisSensorActive) return false;
    if (layoutKey === "default") {
      return currentLayoutKey === "default";
    }
    return currentLayoutKey === layoutKey;
  };

  const handleCreateLayout = async (slotNumber: 1 | 2 | 3) => {
    await createLayout.mutateAsync({
      sensorId: sensor.sensorId,
      organizationId,
      slotNumber,
    });
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors w-full text-left",
            isThisSensorActive && "bg-accent/10 text-accent"
          )}
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform shrink-0",
              isExpanded && "rotate-90"
            )}
          />
          <Thermometer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">{sensor.sensorName}</span>
          {sensor.isPrimary && (
            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
          )}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-5 pl-2 border-l border-border/50 space-y-0.5 py-1">
          {/* Default Layout - always available */}
          <Link
            to={buildLayoutUrl("default")}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-muted/50 transition-colors",
              isLayoutActive("default") && "bg-accent/10 text-accent font-medium"
            )}
          >
            <LayoutGrid className="h-3 w-3 shrink-0" />
            <span>Default</span>
          </Link>

          {/* Layout slots 1-3 */}
          {sensor.layouts.map((slot) => (
            <div key={slot.slotNumber} className="flex items-center">
              {slot.layoutId ? (
                <Link
                  to={buildLayoutUrl(slot.layoutId)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-muted/50 transition-colors flex-1",
                    isLayoutActive(slot.layoutId) && "bg-accent/10 text-accent font-medium"
                  )}
                >
                  <LayoutGrid className="h-3 w-3 shrink-0" />
                  <span className="truncate">{slot.name}</span>
                  {slot.isUserDefault && (
                    <Star className="h-2.5 w-2.5 text-yellow-500 fill-yellow-500 shrink-0" />
                  )}
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 px-2 py-1 h-auto text-xs text-muted-foreground hover:text-foreground w-full justify-start"
                  onClick={() => handleCreateLayout(slot.slotNumber)}
                  disabled={createLayout.isPending}
                >
                  <Plus className="h-3 w-3 shrink-0" />
                  <span>Create Layout {slot.slotNumber}</span>
                </Button>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
