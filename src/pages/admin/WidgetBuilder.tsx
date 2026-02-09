import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { AdminWidgetGrid } from "@/components/frostguard/layouts/AdminWidgetGrid";
import { WidgetPicker } from "@/components/frostguard/layouts/WidgetPicker";
import { type WidgetPlacement, createPlacement } from "@/components/frostguard/registry/widgetFactory";
import { type WidgetRegistryEntry, getWidget } from "@/components/frostguard/registry/widgetRegistry";
import { Button } from "@/lib/components/elements/Button";
import { Card } from "@/lib/components/layout/Card";
import { Plus, Trash2, Layout, RotateCcw } from "lucide-react";
import { cn } from "@/lib/design-system/cn";
import { text as textTokens, surface, border } from "@/lib/design-system/tokens";

const WidgetBuilder = () => {
  const [placements, setPlacements] = useState<WidgetPlacement[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleAddWidget = (widget: WidgetRegistryEntry) => {
    const placement = createPlacement(widget, {}, { x: 0, y: Infinity });
    setPlacements((prev) => [...prev, placement]);
  };

  const handleRemoveWidget = (instanceId: string) => {
    setPlacements((prev) => prev.filter((p) => p.instanceId !== instanceId));
  };

  const handleLayoutChange = (updated: WidgetPlacement[]) => {
    setPlacements(updated);
  };

  const handleClear = () => {
    setPlacements([]);
  };

  const placedWidgetIds = placements.map((p) => p.widgetId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Widget Builder</h1>
            <p className="text-muted-foreground">
              Drag-and-drop canvas to experiment with widget arrangements
            </p>
          </div>
          <div className="flex items-center gap-2">
            {placements.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RotateCcw className="h-4 w-4" />}
                onClick={handleClear}
              >
                Clear All
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setPickerOpen(true)}
            >
              Add Widget
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
          {/* Sidebar: placed widgets list */}
          <div className="col-span-1 space-y-4">
            <h3 className={cn("text-sm font-semibold", textTokens.secondary)}>
              Placed Widgets ({placements.length})
            </h3>
            {placements.length === 0 ? (
              <p className={cn("text-sm", textTokens.tertiary)}>
                No widgets yet. Click "Add Widget" to start.
              </p>
            ) : (
              <div className="space-y-2">
                {placements.map((p) => {
                  const entry = getWidget(p.widgetId);
                  return (
                    <div
                      key={p.instanceId}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg border",
                        surface.raised,
                        border.default,
                      )}
                    >
                      <span className={cn("text-sm", textTokens.secondary)}>
                        {entry?.name || p.widgetId}
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleRemoveWidget(p.instanceId)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main: drag/drop canvas */}
          <div className="col-span-3">
            {placements.length === 0 ? (
              <Card variant="outlined" padding="loose">
                <div className="flex flex-col items-center justify-center py-16">
                  <Layout className={cn("h-12 w-12 mb-3", textTokens.disabled)} />
                  <p className={cn("text-sm", textTokens.tertiary)}>
                    Canvas is empty
                  </p>
                  <p className={cn("text-xs mt-1", textTokens.disabled)}>
                    Add widgets to start building a layout
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={() => setPickerOpen(true)}
                  >
                    Add Widget
                  </Button>
                </div>
              </Card>
            ) : (
              <AdminWidgetGrid
                placements={placements}
                editable
                onLayoutChange={handleLayoutChange}
              />
            )}
          </div>
        </div>

        <WidgetPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleAddWidget}
          appTarget="admin"
          placedWidgetIds={placedWidgetIds}
        />
      </div>
    </DashboardLayout>
  );
};

export default WidgetBuilder;
