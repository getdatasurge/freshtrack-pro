/**
 * Add Widget Modal
 * 
 * Modal for selecting and adding widgets to a custom layout.
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
  
  // Filter to only show widgets that are not already visible
  const addableWidgets = availableWidgets.filter(w => {
    // Widget is addable if it's hidden OR not in the layout at all
    return hiddenWidgetIds.includes(w.id) || !visibleWidgetIds.includes(w.id);
  });

  // Group widgets by category
  const widgetsByCategory = addableWidgets.reduce((acc, widget) => {
    if (!acc[widget.category]) {
      acc[widget.category] = [];
    }
    acc[widget.category].push(widget);
    return acc;
  }, {} as Record<string, typeof addableWidgets>);

  const categoryLabels: Record<string, string> = {
    monitoring: "Monitoring",
    alerts: "Alerts",
    device: "Device & Sensors",
    compliance: "Compliance",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
          <DialogDescription>
            Select a widget to add to your dashboard layout.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          {addableWidgets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>All available widgets are already in your layout.</p>
            </div>
          ) : (
            <div className="space-y-6 pr-4">
              {Object.entries(widgetsByCategory).map(([category, widgets]) => (
                <div key={category}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    {categoryLabels[category] || category}
                  </h4>
                  <div className="grid gap-2">
                    {widgets.map(widget => {
                      const Icon = widget.icon;
                      const isHidden = hiddenWidgetIds.includes(widget.id);
                      
                      return (
                        <button
                          key={widget.id}
                          onClick={() => onAddWidget(widget.id)}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left w-full"
                        >
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
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
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
