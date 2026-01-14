import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer } from "lucide-react";
import type { WidgetProps } from "../types";

export function DowntimeTrackerWidget({ site }: WidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Timer className="h-4 w-4" />
          Downtime Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
        Downtime visualization coming soon
      </CardContent>
    </Card>
  );
}
