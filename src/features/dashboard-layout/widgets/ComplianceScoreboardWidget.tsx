import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";
import type { WidgetProps } from "../types";

export function ComplianceScoreboardWidget({ site }: WidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />
          Compliance Scoreboard
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
        Unit compliance rankings coming soon
      </CardContent>
    </Card>
  );
}
