import { GripHorizontal, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WIDGET_REGISTRY } from "../registry/widgetRegistry";
import { WidgetRenderer } from "./WidgetRenderer";

interface WidgetWrapperProps {
  widgetId: string;
  isCustomizing: boolean;
  isResizing?: boolean;
  canHide: boolean;
  onHide: () => void;
  props: Record<string, unknown>;
}

export function WidgetWrapper({
  widgetId,
  isCustomizing,
  isResizing = false,
  canHide,
  onHide,
  props,
}: WidgetWrapperProps) {
  const widgetDef = WIDGET_REGISTRY[widgetId];
  const Icon = widgetDef?.icon;

  return (
    <Card className="relative h-full overflow-hidden">
      {/* Customize mode overlay */}
      {isCustomizing && (
        <>
          {/* Drag handle */}
          <div className="widget-drag-handle absolute top-0 left-0 right-0 h-8 bg-accent/30 backdrop-blur-sm z-20 cursor-move flex items-center justify-center gap-2 border-b border-accent/20">
            <GripHorizontal className="h-4 w-4 text-accent-foreground/70" />
            <span className="text-xs font-medium text-accent-foreground/70 truncate max-w-32">
              {widgetDef?.name || widgetId}
            </span>
          </div>

          {/* Hide button (only for non-mandatory) */}
          {canHide && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-1 right-1 z-30 h-6 w-6 bg-background/80 hover:bg-destructive/20"
              onClick={(e) => {
                e.stopPropagation();
                onHide();
              }}
            >
              <EyeOff className="h-3 w-3" />
            </Button>
          )}

          {/* Mandatory badge with tooltip */}
          {widgetDef?.mandatory && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    className="absolute bottom-2 right-2 z-20 text-xs cursor-help"
                  >
                    <Lock className="h-3 w-3 mr-1" />
                    Required
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>This widget cannot be hidden or removed</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Border highlight */}
          <div className="absolute inset-0 border-2 border-dashed border-accent/50 rounded-lg pointer-events-none z-10" />
        </>
      )}

      {/* Widget content */}
      <div
        className={`h-full flex flex-col min-h-0 ${isCustomizing ? "pt-8" : ""}`}
        style={{ pointerEvents: isCustomizing ? "none" : "auto" }}
      >
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {isResizing ? (
            <div className="h-full w-full flex items-center justify-center bg-muted/30">
              <div className="text-muted-foreground text-sm flex items-center gap-2">
                {Icon && <Icon className="h-5 w-5" />}
                <span>{widgetDef?.name || widgetId}</span>
              </div>
            </div>
          ) : (
            <WidgetRenderer widgetId={widgetId} props={props} />
          )}
        </div>
      </div>
    </Card>
  );
}
