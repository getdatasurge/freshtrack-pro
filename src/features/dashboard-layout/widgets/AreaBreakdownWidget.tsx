import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import type { WidgetProps } from "../types";

export function AreaBreakdownWidget({ areas = [] }: WidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Area Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
        {areas.length === 0 ? "No areas configured" : "Area breakdown coming soon"}
      </CardContent>
    </Card>
  );
}
