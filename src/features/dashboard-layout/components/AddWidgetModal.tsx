/**
 * Add Widget Modal
 * 
 * Modal for selecting and adding widgets to a custom layout.
 * Supports category grouping, capability-based compatibility filtering,
 * and status indicators.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WIDGET_REGISTRY, getWidgetsForEntity } from "../registry/widgetRegistry";
import type { EntityType } from "../hooks/useEntityLayoutStorage";
import type { DeviceCapability } from "@/lib/registry/capabilityRegistry";
import { checkWidgetCompatibility, checkWidgetCompatibilityBySensorType } from "../utils/compatibilityMatrix";
import { cn } from "@/lib/utils";
import { AlertTriangle, Ban } from "lucide-react";

interface AddWidgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  visibleWidgetIds: string[];
  hiddenWidgetIds: string[];
  onAddWidget: (widgetId: string) => void;
  /** Available capabilities for this unit (preferred for validation) */
  unitCapabilities?: DeviceCapability[];
  /** Legacy sensor type for backward compatibility */
  sensorType?: string;
  /** Payload type for display */
  payloadType?: string;
  /** Binding confidence for low-confidence warnings */
  bindingConfidence?: number;
}

export function AddWidgetModal({
  open,
  onOpenChange,
  entityType,
  visibleWidgetIds,
  hiddenWidgetIds,
  onAddWidget,
  unitCapabilities,
  sensorType,
  payloadType,
  bindingConfidence,
}: AddWidgetModalProps) {
  // Get widgets available for this entity type
  const availableWidgets = getWidgetsForEntity(entityType);
  
  // Filter to only show widgets that are not already visible (or are hidden)
  const addableWidgets = availableWidgets.filter(w => {
    // Widget is addable if it's hidden OR not in the layout at all
    return hiddenWidgetIds.includes(w.id) || !visibleWidgetIds.includes(w.id);
  });

  // Group widgets by category
  const widgetsByCategory = addableWidgets.reduce((acc, widget) => {
    const category = widget.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(widget);
    return acc;
  }, {} as Record<string, typeof addableWidgets>);

  const categoryLabels: Record<string, string> = {
    monitoring: "Monitoring",
    alerts: "Alerts",
    device: "Device & Sensors",
    compliance: "Compliance",
    utility: "Utility & Actions",
    other: "Other",
  };

  const categoryOrder = ["monitoring", "alerts", "device", "compliance", "utility", "other"];
  const sortedCategories = Object.keys(widgetsByCategory).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  /**
   * Check widget compatibility using capabilities or sensor type.
   */
  const getWidgetCompatibility = (widgetId: string) => {
    // Use capability-based validation if available
    if (unitCapabilities && unitCapabilities.length > 0) {
      return checkWidgetCompatibility(widgetId, unitCapabilities);
    }
    // Fall back to sensor type
    return checkWidgetCompatibilityBySensorType(widgetId, sensorType);
  };

  const handleAddWidget = (widgetId: string) => {
    onAddWidget(widgetId);
    // Keep modal open so user can add multiple widgets
  };

  const hasCapabilityContext = (unitCapabilities && unitCapabilities.length > 0) || !!sensorType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col !gap-0 p-0">
        {/* Fixed Header */}
        <DialogHeader className="flex-shrink-0 p-6 pb-4">
          <DialogTitle>Add Widget</DialogTitle>
          <DialogDescription>
            Select widgets to add to your dashboard layout.
            {payloadType && (
              <span className="block mt-1 text-xs">
                Sensor type: <span className="font-mono">{payloadType}</span>
                {bindingConfidence && bindingConfidence < 0.8 && (
                  <Badge variant="outline" className="ml-2 text-warning border-warning/30">
                    Low confidence
                  </Badge>
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {addableWidgets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>All available widgets are already in your layout.</p>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {sortedCategories.map((category) => {
                const widgets = widgetsByCategory[category];
                if (!widgets?.length) return null;

                return (
                  <div key={category}>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                      {categoryLabels[category] || category}
                    </h4>
                    <div className="grid gap-2">
                      {widgets.map(widget => {
                        const Icon = widget.icon;
                        const isHidden = hiddenWidgetIds.includes(widget.id);
                        const compatibility = getWidgetCompatibility(widget.id);
                        const isIncompatible = hasCapabilityContext && !compatibility.compatible;
                        const isPartial = compatibility.partial;

                        return (
                          <TooltipProvider key={widget.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => !isIncompatible && handleAddWidget(widget.id)}
                                  disabled={isIncompatible}
                                  className={cn(
                                    "flex items-start gap-3 p-3 rounded-lg border border-border",
                                    "text-left w-full group transition-colors",
                                    isIncompatible
                                      ? "opacity-50 cursor-not-allowed bg-muted/30"
                                      : "hover:bg-accent/50 hover:border-accent cursor-pointer"
                                  )}
                                >
                                  <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                    isIncompatible
                                      ? "bg-muted"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}>
                                    <Icon className={cn(
                                      "w-5 h-5",
                                      isIncompatible
                                        ? "text-muted-foreground/50"
                                        : "text-muted-foreground group-hover:text-accent-foreground"
                                    )} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className={cn(
                                        "font-medium text-sm",
                                        isIncompatible && "text-muted-foreground"
                                      )}>
                                        {widget.name}
                                      </p>
                                      {isHidden && (
                                        <Badge variant="secondary" className="text-xs">
                                          Hidden
                                        </Badge>
                                      )}
                                      {widget.mandatory && (
                                        <Badge variant="outline" className="text-xs">
                                          Required
                                        </Badge>
                                      )}
                                      {isIncompatible && (
                                        <Badge variant="destructive" className="text-xs flex items-center gap-1">
                                          <Ban className="w-3 h-3" />
                                          Incompatible
                                        </Badge>
                                      )}
                                      {isPartial && !isIncompatible && (
                                        <Badge variant="outline" className="text-xs text-warning border-warning/30">
                                          <AlertTriangle className="w-3 h-3 mr-1" />
                                          Partial
                                        </Badge>
                                      )}
                                    </div>
                                    <p className={cn(
                                      "text-xs mt-0.5 line-clamp-2",
                                      isIncompatible
                                        ? "text-muted-foreground/50"
                                        : "text-muted-foreground"
                                    )}>
                                      {widget.description}
                                    </p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">
                                      {widget.defaultW}×{widget.defaultH} grid units
                                    </p>
                                  </div>
                                </button>
                              </TooltipTrigger>
                              {(isIncompatible || isPartial) && compatibility.reason && (
                                <TooltipContent side="left" className="max-w-xs">
                                  <p className="text-sm">{compatibility.reason}</p>
                                  {widget.requiredCapabilities && widget.requiredCapabilities.length > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Requires: {widget.requiredCapabilities.join(', ')}
                                    </p>
                                  )}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 flex justify-end p-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
