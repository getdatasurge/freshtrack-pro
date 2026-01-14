/**
 * Add Widget Modal
 * 
 * Modal for selecting and adding widgets to a custom layout.
 * Supports category grouping and status indicators.
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { WIDGET_REGISTRY, getWidgetsForEntity } from "../registry/widgetRegistry";
import type { EntityType } from "../hooks/useEntityLayoutStorage";
import { cn } from "@/lib/utils";

interface AddWidgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  visibleWidgetIds: string[];
  hiddenWidgetIds: string[];
  onAddWidget: (widgetId: string) => void;
}

export function AddWidgetModal({
  open,
  onOpenChange,
  entityType,
  visibleWidgetIds,
  hiddenWidgetIds,
  onAddWidget,
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

  const handleAddWidget = (widgetId: string) => {
    onAddWidget(widgetId);
    // Keep modal open so user can add multiple widgets
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
          <DialogDescription>
            Select widgets to add to your dashboard layout.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 -mx-6 px-6 max-h-[60vh]">
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
                        
                        return (
                          <button
                            key={widget.id}
                            onClick={() => handleAddWidget(widget.id)}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-lg border border-border",
                              "hover:bg-accent/50 hover:border-accent transition-colors",
                              "text-left w-full group"
                            )}
                          >
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                              <Icon className="w-5 h-5 text-muted-foreground group-hover:text-accent-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm">{widget.name}</p>
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
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {widget.description}
                              </p>
                              <p className="text-xs text-muted-foreground/60 mt-1">
                                {widget.defaultW}×{widget.defaultH} grid units
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        <div className="flex justify-end pt-4 border-t border-border -mx-6 px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
