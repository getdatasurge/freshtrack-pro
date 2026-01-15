import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "lucide-react";
import type { WidgetProps } from "../types";

export function UnitTypeDistributionWidget({ site }: WidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <PieChart className="h-4 w-4" />
          Unit Type Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
        Unit type pie chart coming soon
      </CardContent>
    </Card>
  );
}
