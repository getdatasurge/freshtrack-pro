import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutGrid } from "lucide-react";
import type { WidgetProps } from "../types";

export function QuickStatsCardsWidget({ site, totalUnits }: WidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Quick Stats Cards
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-4">
        {totalUnits !== undefined ? `${totalUnits} units monitored` : "Customizable KPIs coming soon"}
      </CardContent>
    </Card>
  );
}
