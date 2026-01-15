import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WIDGET_REGISTRY } from "../registry/widgetRegistry";

interface HiddenWidgetsPanelProps {
  hiddenWidgetIds: string[];
  onRestore: (widgetId: string) => void;
  onRestoreAll: () => void;
}

export function HiddenWidgetsPanel({
  hiddenWidgetIds,
  onRestore,
  onRestoreAll,
}: HiddenWidgetsPanelProps) {
  if (hiddenWidgetIds.length === 0) {
    return null;
  }

  return (
    <Card className="bg-muted/50 border-dashed">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-muted-foreground" />
            Hidden Widgets ({hiddenWidgetIds.length})
          </CardTitle>
          {hiddenWidgetIds.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRestoreAll}
              className="text-xs"
            >
              Restore All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="flex flex-wrap gap-2">
        {hiddenWidgetIds.map((id) => {
            const widget = WIDGET_REGISTRY[id];
            const Icon = widget?.icon;
            return (
              <Badge
                key={id}
                variant="outline"
                className="flex items-center gap-1.5 py-1.5 px-2 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => onRestore(id)}
              >
                {Icon ? <Icon className="h-3 w-3" /> : null}
                <span className="text-xs">{widget?.name || id}</span>
                <Eye className="h-3 w-3 ml-1 text-muted-foreground" />
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
