import { Link, useParams } from "react-router-dom";
import { ChevronRight, Box, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SensorAccordionItem } from "./SensorAccordionItem";
import type { UnitNavItem } from "@/hooks/useUnitsNavTree";

interface UnitAccordionItemProps {
  unit: UnitNavItem;
  organizationId: string;
  isExpanded: boolean;
  onToggle: () => void;
  isSensorExpanded: (sensorId: string) => boolean;
  onToggleSensor: (sensorId: string) => void;
}

export function UnitAccordionItem({
  unit,
  organizationId,
  isExpanded,
  onToggle,
  isSensorExpanded,
  onToggleSensor,
}: UnitAccordionItemProps) {
  const params = useParams<{ unitId: string }>();
  const isActiveUnit = params.unitId === unit.unitId;

  const statusColor =
    unit.status === "online"
      ? "text-emerald-500"
      : unit.status === "warning"
      ? "text-yellow-500"
      : unit.status === "critical"
      ? "text-red-500"
      : "text-muted-foreground";

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors w-full text-left",
            isActiveUnit && "bg-accent/10"
          )}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0",
              isExpanded && "rotate-90"
            )}
          />
          <Box className={cn("h-4 w-4 shrink-0", statusColor)} />
          <span className={cn("truncate flex-1", isActiveUnit && "font-medium text-accent")}>
            {unit.unitName}
          </span>
          {unit.sensors.length > 0 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
              {unit.sensors.length}
            </Badge>
          )}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-3 pl-2 border-l border-border/50 space-y-0.5 py-1">
          {unit.sensors.length === 0 ? (
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              <span>No sensors</span>
            </div>
          ) : (
            unit.sensors.map((sensor) => (
              <SensorAccordionItem
                key={sensor.sensorId}
                sensor={sensor}
                unitId={unit.unitId}
                organizationId={organizationId}
                isExpanded={isSensorExpanded(sensor.sensorId)}
                onToggle={() => onToggleSensor(sensor.sensorId)}
              />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
